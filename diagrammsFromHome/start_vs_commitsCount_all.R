# install.packages("rlang")
# install.packages(c("ggplot2", "dplyr", "readr", "tidyr"))

library(readr)
library(dplyr)
library(lubridate)
library(ggplot2)
library(purrr)
library(stringr)
library(tibble)


# Ordner, in dem alle CSVs liegen
dir_path <- "F:/Hochschule/BA/gitlog_analysis"

# Alle sample-Dateien finden (z.B. criteriaTable_sample1.csv ... sample5.csv)
files <- list.files(
  path = dir_path,
  pattern = "^criteriaTable_sample\\d+\\.csv$",
  full.names = TRUE
)

# 3) Verarbeitung
all_samples <- map_dfr(files, function(fp) {
  df <- read_csv(fp, show_col_types = FALSE)
  df %>%
  mutate(
    start_dt = dmy_hms(start_date),
    deadline_dt = dmy_hms(deadline),
    start_h = as.numeric(difftime(deadline_dt, start_dt, units = "hours")),
    author_num = parse_number(author),
    sample = str_extract(basename(fp), "sample\\d+")
  ) %>%
  transmute(
    sample = sample,
    author = author_num,
    commits = total_commits,
    start_h = round(start_h, 2)
  ) %>%
  #https://www.rdocumentation.org/packages/dplyr/versions/0.7.8/topics/filter
  filter(start_h >= 0) %>%
  arrange(start_h)
})
print(all_samples)

# 4) Pearson-Korrelation
pearson_r <- all_samples %>%
  group_by(sample) %>%
  summarise(
    pearson_r = cor(commits, start_h, method = "pearson", use = "complete.obs"),
    n = sum(complete.cases(commits, start_h)),
    .groups = "drop"
  )

legend_labels <- pearson_r %>%
  mutate(label = paste0(sample, " (r=", sprintf("%.3f", pearson_r), ")")) %>%
  select(sample, label) %>%
  deframe()  # named vector: names=sample, values=label

plot <- ggplot(all_samples, aes(x = start_h, y = commits, color = sample)) +
  geom_point() +
  scale_color_manual(values = c(
    "sample1" = "#311b9e",
    "sample2" = "#d95f02",
    "sample3" = "#7570b3",
    "sample4" = "#e7298a",
    "sample5" = "#66a61e"
  ), labels = legend_labels) +
  labs(
    title = "Startzeit vs. gesamte Anzahl von Commits",
    x = "Startzeit vor Deadline (Stunden)",
    y = "Anzahl der Commits",
    color = "Sample"
  ) +
  theme_minimal()

print(plot)

ggsave(
  filename = "startzeit_vs_commits_all.pdf",
  plot = plot,
  width = 11,
  height = 5,
  device = cairo_pdf
)

