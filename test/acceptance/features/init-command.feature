Feature: Init command

  Scenario: Init in a scaffolded project reports files installed and team confirmation pending
    Given the current directory has a ".squad" directory
    When I run "squad init"
    Then the output contains "Squad files installed."
    And the output contains "Team not yet constituted."
    And the output contains "Squad will propose a team for your confirmation before starting domain work."
    And the output contains "already exists"
    And the exit code is 0

  Scenario: Init exit code is zero on success
    When I run "squad init"
    Then the exit code is 0
