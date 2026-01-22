library(readr)
library(dplyr)
library(lubridate)
library(ggplot2)
library(purrr)
library(stringr)
library(tibble)

dir_path <- "F:/Hochschule/BA/gitlog_analysis"

files <- list.files(
  path = dir_path,
  pattern = "^criteriaTable_sample\\d+\\.csv$",
  full.names = TRUE
)

all_samples_changes <- map_dfr(files, function(fp) {
  df <- read_csv(fp, show_col_types = FALSE)
  
  df %>%
    mutate(
      sample = str_extract(basename(fp), "sample\\d+"),
      # Zahl in Klammern aus "100.00% (271)" extrahieren -> 271
      total_changes_n = as.numeric(str_match(total_changes, "\\((\\d+)\\)")[, 2])
    ) %>%
    transmute(
      sample,
      total_changes_n,
      commits = total_commits,
    ) %>%
    filter(
      !is.na(total_changes_n),
      total_changes_n < 5000
    ) %>%
    arrange(total_changes_n)
})

print(all_samples_changes)

# Pearson r pro Sample
pearson_tbl <- all_samples_changes %>%
  group_by(sample) %>%
  summarise(
    pearson_r = cor(commits, total_changes_n, method = "pearson", use = "complete.obs"),
    n = sum(complete.cases(commits, total_changes_n)),
    .groups = "drop"
  )

print(pearson_tbl)

# Legenden-Labels: "sampleX (r=...)"
legend_labels <- pearson_tbl %>%
  mutate(label = paste0(sample, " (r=", sprintf("%.3f", pearson_r), ")")) %>%
  select(sample, label) %>%
  deframe()

# Plot: Farbe = sample
plot_changes <- ggplot(all_samples_changes, aes(x = commits, y = total_changes_n, color = sample)) +
  geom_point() +
  scale_color_manual(
    values = c(
      "sample1" = "#311b9e",
      "sample2" = "#d95f02",
      "sample3" = "#7570b3",
      "sample4" = "#e7298a",
      "sample5" = "#66a61e"
    ),
    labels = legend_labels
  ) +
  labs(
    title = "Gesamte Anzahl von Commits vs. Änderungsumfang",
    x = "Anzahl der Commits",
    y = "Total changes",
    color = "Sample"
  ) +
  theme_minimal()

print(plot_changes)

# PDF speichern
ggsave(
  filename = "total_commits_vs_total_changes_all.pdf",
  plot = plot_changes,
  width = 11,
  height = 5,
  device = cairo_pdf
)
