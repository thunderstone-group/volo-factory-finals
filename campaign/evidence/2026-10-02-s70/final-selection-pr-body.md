Retain the validated agent code on main and the existing scored competition submission. The user prioritizes score over cleanup; the follow-on v12 experiment did not establish non-inferiority and its three prompt changes are reverted. The final PR diff contains documentation only.

Record the complete audit and validation evidence, including primary-model stream failures, Kimi fallback drafts, incomplete usage, and the failed v12 fixed checks. These mixed conditions do not establish that the cleanup caused the regression. The main package still matches the tested v11 SHA cd0f596905b202bd5b79c040e7478ed65c204d51fb0c59c02c23beacc59baa5c byte for byte.

The official submission remains 12e3bab723fd with GitHub 79/100 and Sheet 87/100, S104.95888048198316. Final runs 9f40df0b587e and 8c80a2b899ac started before the cutoff and are still being observed. The current handoff distinguishes the delivered main code, the formal scoring package, and these unfinished runs.

Validation: documentation diff check and secret scan passed; the rebuilt package is unchanged. Earlier experiment checks and their limitations are recorded in the evidence instead of being presented as a score improvement.
