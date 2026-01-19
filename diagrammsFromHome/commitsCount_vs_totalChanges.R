library(readr)
library(dplyr)
library(lubridate)
library(ggplot2)
library(stringr)

file_path <- "F:/Hochschule/BA/gitlog_analysis/criteriaTable_sample5.csv"

# CSV einlesen
df <- read_csv(file_path, show_col_types = FALSE)

# Verarbeitung
result <- df %>%
  mutate(
    # Zahl in Klammern aus "100.00% (271)" extrahieren -> 271
    total_changes_n = as.numeric(str_match(total_changes, "\\((\\d+)\\)")[, 2]),
    author_num = parse_number(author)
  ) %>%
  transmute(
    author = author_num,
    commits = total_commits,
    total_changes_n
  ) %>%
  filter(
    !is.na(total_changes_n)
  ) %>%
  arrange(commits)

print(result)

# Pearson-Korrelation
pearson_r <- cor(
  result$commits,
  result$total_changes_n,
  method = "pearson",
  use = "complete.obs"
)

cat("Pearson-Korrelation r =", pearson_r, "\n")
out <- paste("total_commits & total_changes. Pearson-Korrelation r =", round(pearson_r, 3))

# Plot
plot <- ggplot(result, aes(x = commits, y = total_changes_n)) +
  geom_point() +
  labs(
    title = out,
    x = "Startzeit vor Deadline (Stunden)",
    y = "Total changes (Anzahl in Klammern)"
  ) +
  theme_minimal()

print(plot)

# PDF speichern
ggsave(
  filename = "total_commits_vs_total_changes_sample5.pdf",
  plot = plot,
  width = 8,
  height = 5,
  device = cairo_pdf
)
