# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - button "ArcHub" [ref=e4] [cursor=pointer]:
      - img [ref=e5]
    - link "ArcHub" [ref=e8] [cursor=pointer]:
      - /url: "#/"
    - navigation "Main navigation" [ref=e9]:
      - link "Home" [ref=e10] [cursor=pointer]:
        - /url: "#/"
    - generic [ref=e11]:
      - generic [ref=e12]: evo-audit-viewer
      - button "Account menu" [ref=e13] [cursor=pointer]
  - generic [ref=e14]:
    - main [ref=e15]:
      - heading "Your organizations" [level=1] [ref=e16]
      - paragraph [ref=e17]:
        - link "New organization" [ref=e18] [cursor=pointer]:
          - /url: "#/orgs/new"
      - article [ref=e19]:
        - heading "Evo Audit Org" [level=3] [ref=e20]:
          - link "Evo Audit Org" [ref=e21] [cursor=pointer]:
            - /url: "#/org/evo-audit-org"
    - complementary [ref=e22]:
      - button "Home" [ref=e23] [cursor=pointer]
      - button "Explore" [ref=e24] [cursor=pointer]
  - contentinfo [ref=e25]: ArcHub collaboration platform. Header · Sidebar · Main content · Footer
```