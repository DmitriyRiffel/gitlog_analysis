# install.packages(c("readr","dplyr","lubridate","ggplot2","stringr","purrr"))

library(readr)
library(dplyr)
library(lubridate)
library(ggplot2)
library(stringr)
library(purrr)

# Ordner, in dem alle CSVs liegen
dir_path <- "F:/Hochschule/BA/gitlog_analysis"

# Alle sample-Dateien finden (z.B. criteriaTable_sample1.csv ... sample5.csv)
files <- list.files(
  path = dir_path,
  pattern = "^criteriaTable_sample\\d+\\.csv$",
  full.names = TRUE
)

# Einlesen + auf ein gemeinsames Format bringen
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
      sample,
      author = author_num,
      start_h = round(start_h, 2),
      bundling = as.numeric(bundling)
    ) %>%
    filter(start_h >= 0) # optional wie bei dir
})

print(all_samples)

# Optional: Korrelation pro Sample ausgeben
corr_by_sample <- all_samples %>%
  group_by(sample) %>%
  summarise(
    pearson_r = cor(bundling, start_h, method = "pearson", use = "complete.obs"),
    n = sum(complete.cases(bundling, start_h)),
    .groups = "drop"
  )

print(corr_by_sample)

# Plot: alle Samples in einem Diagramm, Farbe = Sample
plot_all <- ggplot(all_samples, aes(x = start_h, y = bundling, color = sample)) +
  geom_point() +
  labs(
    title = "Startzeit vor Deadline vs. Commit-Bündelung   (alle Samples)",
    x = "Startzeit vor Deadline (Stunden)",
    y = "Commit-Bündelung",
    color = "Sample"
  ) +
  theme_minimal()

print(plot_all)

# Export als PDF
ggsave(
  filename = "startzeit_bundeling_all_samples.pdf",
  plot = plot_all,
  width = 9,
  height = 5,
  device = cairo_pdf
)
