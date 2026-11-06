TEMPLATE FOR RETROSPECTIVE (Team ##)
=====================================

The retrospective should include _at least_ the following
sections:

- [process measures](#process-measures)
- [quality measures](#quality-measures)
- [general assessment](#assessment)

## PROCESS MEASURES 

### Macro statistics

- Number of stories committed vs done : 4 vs 4
- Total points committed vs done : 20 vs 20
- Nr of hours planned vs spent (as a team) : planned: 82h 30m spent: 82h 59m

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
| _#0_   | 14      |    -   | 41h        |      41h 48m |
| _#1_   | 8       |    8   | 16h 30m    |      17h 57m |
| _#2_   | 5       |    5   | 12h        |      10h 31m |
| _#3_   | 3       |    2   | 4h 30m     |      4h 48m  |
| _#4_   | 4       |    5   | 8h 30m     |      7h 55m  |

> place technical tasks corresponding to story `#0` and leave out story points (not applicable in this case)

- Hours per task  <span style="color:red">per person</span>  (average, standard deviation) average = 1h 29m standard deviation = 46m
- Total task estimation error ratio: sum of total hours estimation / sum of total hours spent -1 Total task estimation error ratio: -0.58%

  
## QUALITY MEASURES 

- Unit Testing:
  - Total hours estimated 5h
  - Total hours spent 4h 34m
  - Nr of automated unit test cases 174
  - Coverage (if available) Unit test coverage: 94.08% line coverage, 91.56% branch coverage
- Integration testing:
  - Total hours estimated 2h
  - Total hours spent 1h 43m
- E2E testing:
  - Total hours estimated 4h
  - Total hours spent 5h 16m
- Code review: 
  - Total hours estimated 5h
  - Total hours spent 4h 9m

  


## ASSESSMENT

- What caused your errors in estimation (if any)? Overall, our estimation was quite accurate, with only a small difference between the total estimated and actual time. However, end-to-end testing required significantly more time than expected because, during testing, we discovered an issue that invalidated part of the work already done and required us to substantially rework the E2E test suite.

- What lessons did you learn (both positive and negative) in this sprint? We learned that code reviews and checks should be performed more frequently throughout the sprint. We discovered a bug quite late in the development process, which showed us that more regular reviews could help identify issues earlier.

- Which improvement goals set in the previous retrospective were you able to achieve? We were able to limit the amount of work assigned to each person on a single task to approximately two hours, track the time spent on code reviews, and make a clearer distinction between unit testing and end-to-end testing.
  
- Which ones you were not able to achieve? Why? We were not able to identify all the tasks related to each user story during the initial planning phase. A few days after planning, we had to update MH-26 to also include registration and create MH-27 to cover testing for login, authentication, and registration. This showed that some parts of the user stories had not been broken down into tasks in enough detail during planning.

- Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.) For the next sprint, we want to improve both code review frequency and task planning. We plan to perform more regular code reviews during development instead of mainly checking the code near the end of the sprint. We also want to analyse each user story more carefully during planning, identifying implementation, testing, integration, and validation tasks before the sprint starts.

> Propose one or two

- One thing you are proud of as a Team!! We are proud of the quality of the delivered increment and of the way the team worked together to achieve it. Communication within the team was effective throughout the sprint, especially through Telegram, which helped us coordinate activities and resolve issues quickly.