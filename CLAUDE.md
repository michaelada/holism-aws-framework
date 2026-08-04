There should be a full set of unit tests for the new functionality, and if code changesd please make sure that the tests are updated to work.

Could you use the spec driven development approach to this work following the workflow of requirements, design and task breakdown, and in the design can you provide a set of wireframes showing how it might look.

As part of any change please make sure that documentation is also updated.

In all cases when adding new functionality can you keep in mind that we have a component library and if the work looks like it could be shared with other front ends e.g. the Account User Interface, then please implement it within the shared component package.

As part of this work, if you have updates to the code to make, could you make sure the deployment steps, terraform scripts etc also get updated in line with any changes.


**5. NEVER Touch Git Without Explicit Request (Strictly Enforced)**
Do NOT run any git operation unless USER explicitly ask for it in that message. This includes — but is not limited to — commits, pushes, branch creation/switching, merges, rebases, cherry-picks, resets, stashes, tags, and force operations. Making code edits is fine; turning them into git history is NOT, unless USER say so. After finishing work, leave the changes in the working tree and stop — do not offer to commit unless asked. "Go ahead"/"approved" on a coding task does NOT imply permission to commit or push.