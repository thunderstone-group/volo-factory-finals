import json, sys

SP = "/private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad"

def main():
    task = sys.argv[1]  # sheet | github
    prefix = sys.argv[2]  # e.g. REQ-4  (matches req == prefix or req starts with prefix + '-')
    intents = json.load(open(f"{SP}/oracle/{task}-intents.json"))
    flat = json.load(open(f"{SP}/coverage/_work/req-flat-{task}.json"))

    def matches(req):
        return req == prefix or req.startswith(prefix + "-")

    sel = [x for x in intents if matches(x["req"])]
    sel.sort(key=lambda x: x["order"])

    seen_reqs = []
    for x in sel:
        if x["req"] not in seen_reqs:
            seen_reqs.append(x["req"])

    # Build full ancestor chain (excluding ROOT) for every atomic req involved, dedup, keep top-down order.
    def ancestors_top_down(rid):
        chain = []
        cur = rid
        while cur is not None:
            chain.append(cur)
            cur = flat[cur]["parent"]
        chain.reverse()
        return chain  # includes ROOT first

    all_ids_ordered = []
    for rid in seen_reqs:
        for a in ancestors_top_down(rid):
            if flat[a]["type"] == "FOLDER" and flat[a]["parent"] is None:
                continue  # skip ROOT itself (too generic / huge)
            if a not in all_ids_ordered:
                all_ids_ordered.append(a)

    print(f"##### Requirement/folder descriptions relevant to group {prefix} ({task}) #####\n")
    for rid in all_ids_ordered:
        n = flat[rid]
        print(f"--- [{n['id']}] ({n['type']}) {n['name']} ---")
        print(n['description'])
        print()

    print(f"\n##### Intents for group {prefix} ({task}) — {len(sel)} scenarios #####\n")
    for x in sel:
        print(f"=== order={x['order']} req={x['req']} n={x['n']} ===")
        print(f"scenario_name: {x['scenario_name']}")
        print(f"hidden_intent_zh: {x['hidden_intent_zh']}")
        for s in x["steps"]:
            print(f"  {s['keyword']}: {s['content']}")
        print()

if __name__ == "__main__":
    main()
