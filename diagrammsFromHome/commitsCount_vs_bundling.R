library(readr)
library(dplyr)
library(ggplot2)

file_path <- "F:/Hochschule/BA/gitlog_analysis/criteriaTable_sample5.csv"

# CSV einlesen
df <- read_csv(file_path, show_col_types = FALSE)

# Verarbeitung
result <- df %>%
  transmute(
    commits = total_commits,
    bundling = as.numeric(bundling)
  ) %>%
  filter(
    !is.na(commits),
    !is.na(bundling)
  ) %>%
  arrange(commits)

print(result)

# Pearson-Korrelation
pearson_r <- cor(
  result$commits,
  result$bundling,
  method = "pearson",
  use = "complete.obs"
)

cat("Pearson-Korrelation r =", pearson_r, "\n")
out <- paste("total_commits & bundling. Pearson-Korrelation r =", round(pearson_r, 3))

# Plot
plot <- ggplot(result, aes(x = commits, y = bundling)) +
  geom_point() +
  labs(
    title = out,
    x = "Anzahl der Commits (total_commits)",
    y = "Bundling (0-1)"
  ) +
  theme_minimal()

print(plot)

ggsave(
  filename = "total_commits_vs_bundling_sample5.pdf",
  plot = plot,
  width = 8,
  height = 5,
  device = cairo_pdf
)
