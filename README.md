Erklärung zu den Spalten:

-commits = Gesammte Anzahl von Commits, wo irgendwas geändert wurde (hier zählen keine Kommentar-Änderungen, keine
Leerzeichen- und Leerzeilen-Änderugnen). Wenn in einem Commit nur solche Änderungen vorkommen, dann wird dieser Commit
nicht gezählt. Es werdem auch die Änderungen in Tests-Dateien oder in ausgeschlossenen Dateien nicht mitgezählt

-changes = "Sinnvolle" Änderungen aus der Commits-Spalte

-comment_changes = Kommentar-Änderugen. Die werden separat von "sinnvollen" Änderungen mitgezählt. Damit man überblick hat, wie viel Kommentar-Änderungen gemacht wurden. Das wird nicht berücksichtigt bei der Bestimmung von dem Auffälligkeitsindex. Das ist für allgemeinen Überblick

-tests_changes = Änderungen in Test-Dateien. Die werden separat mitgezählt. Dabei werden die Commits, wo nur Änderungen in Test-Dateien gemacht wurden, nicht in "commits" mitgezählt. Dabei werden die auch nur "sinnvolle" Änderungen mitgezählt.

-first_date = Das Datum und die Uhrzeit von dem erstgemachten Commit

-last_date = Das Datum und die Uhrzeit von dem letztgemachten Commit

-deadline = Das Datum und die Uhrzeit von dem Abgabetermin

-first_on_deadline = Binär-Kriterium, ob der erste Commit an dem Tag von Deadline war

-few_commits = Binär-Kriterium, ob der Student zu wenig Commits gemacht hat

-few_changes = Binär-Kriterium, ob der Student zu wenig Änderungen gemacht hat

-late_start = Binär-Kriterium, ob ein Student "zu spät" angenfangen hat. Dafür gilt die geschätzte Aufwand, die standardmäßig 6 Stunden ist

-session = Anzahl von Sessions, in den man seine Aufgabe gemacht hat. Standardmäßig beträgt ein Abstand zwischen Commits 2 Stunden, damit es als eine Session betrachtet werden kann. Das wird nicht berücksichtigt bei der Bestimmung von dem Auffälligkeitsindex. Das ist für allgemeinen Überblick

-avg_commits = Durschschnittliche Anzahl von Commits in einer Session. Das wird nicht berücksichtigt bei der Bestimmung von dem Auffälligkeitsindex. Das ist für allgemeinen Überblick

-index = Auffälligkeitsindex im Bereich von 0 bis 1
