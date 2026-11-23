TEMPLATE FOR RETROSPECTIVE (Team 12)
=====================================

The retrospective should include _at least_ the following
sections:

- [process measures](#process-measures)
- [quality measures](#quality-measures)
- [general assessment](#assessment)

## PROCESS MEASURES 

### Macro statistics

- Number of stories committed vs done : 4 vs 4
- Total points committed vs done : 13 vs 13
- Nr of hours planned vs spent (as a team) : 81h 30m planned vs 72h 50m

**Remember**  a story is done ONLY if it fits the Definition of Done:
 
- Unit Tests passing 
- Code review completed
- Code present on VCS
- End-to-End tests performed

> Please refine your DoD 

- Acceptance criteria are satisfied
- Unit tests are implemented and passing
- Relevant integration and E2E tests are passing
- Code review is completed
- Code is committed and merged into the shared VCS
- The feature is integrated with the current application without blocking defects

### Detailed statistics

| Story  | # Tasks | Points | Hours est. | Hours actual |
|--------|---------|--------|------------|--------------|
| _#0_   |    14   |    -   |   34h 30m  |   31h 28m    |
| _#5_   |    5    |    3   |   11h      |   10h 36m    |
| _#6_   |    5    |    5   |   14h      |   14h 40m    |
| _#7_   |    5    |    3   |   13h      |   9h 55m     |
| _#8_   |    5    |    2   |   9h       |   6h 11m     |
   

> place technical tasks corresponding to story `#0` and leave out story points (not applicable in this case)

- Hours per task  <span style="color:red">per person</span>  (average, standard deviation): 1h 24m average, 33m standard deviation (using Estimation per Person)
- Total task estimation error ratio: sum of total hours estimation / sum of total hours spent -1: 81h 30m / 72h 50m - 1 = +0,119 = +11.9% 
  
## QUALITY MEASURES 

- Unit Testing:
  - Total hours estimated: 7h 30m
  - Total hours spent: 6h 14m
  - Nr of automated unit test cases: 371
  - Coverage (if available): 93.07% line coverage, 91.89% branch coverage
- Integration testing:
  - Total hours estimated: 7h 30m
  - Total hours spent: 6h 33m
- E2E testing:
  - Total hours estimated: 10h
  - Total hours spent: 8h 40m
- Code review: 
  - Total hours estimated: 5h
  - Total hours spent: 4h 26m

  


## ASSESSMENT

- What caused your errors in estimation (if any)? Our estimation errors were mainly caused by relying too much on the experience of the previous sprint. During the first sprint, we were still defining the data structures and becoming familiar with the project architecture, so several backend and testing activities took longer. In this sprint, we were able to work more quickly because the architecture was already established and the team had more experience with the codebase. As a result, backend and testing tasks were generally overestimated, while some frontend activities required more time than expected.

- What lessons did you learn (both positive and negative) in this sprint? We learned that our increasing familiarity with the project allows us to implement and test backend features more efficiently, so future estimates should take this improvement into account. At the same time, frontend work can still be difficult to estimate because UI changes often require additional integration and refinement. A positive result was that, unlike in the previous sprint, we did not discover any major bugs at the end of development, suggesting that our focus on testing and code quality was effective.

- Which improvement goals set in the previous retrospective were you able to achieve? We improved the overall quality-control process. Testing and code review were performed more systematically, and we addressed all the issues and feedback assigned to us during the previous demo. This also helped us avoid discovering critical problems only at the end of the sprint. 
  
- Which ones you were not able to achieve? Why? We were not able to maintain the same amount of completed story points as in the previous sprint. We completed 13 story points compared with 20 in the previous sprint. Part of the team's effort was dedicated to improving existing functionality and resolving issues identified during the previous demo, which increased product quality but did not necessarily contribute to completing new story points.

- Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.) For the next sprint, we want to improve our estimation process by taking into account the experience gained during the previous sprints, especially for backend and testing activities, which can now be completed more efficiently. Finally, we should review our story-point estimates to make sure they better represent the actual complexity of the stories, since the number of completed points alone may not fully reflect the amount of work spent on quality improvements and fixes.

> Propose one or two

- One thing you are proud of as a Team!! We are proud of how the team worked together throughout the sprint. Communication and coordination improved and we were able to address the feedback from the previous demo while keeping the project stable and progressing toward the sprint goals.