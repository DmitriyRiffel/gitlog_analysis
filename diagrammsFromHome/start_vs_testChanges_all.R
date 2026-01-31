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
      start_dt = dmy_hms(start_date),
      deadline_dt = dmy_hms(deadline),
      start_h = as.numeric(difftime(deadline_dt, start_dt, units = "hours")),
      author_num = parse_number(author),
      sample = str_extract(basename(fp), "sample\\d+"),
      # Prozentwert aus "74.80 % (1475)" extrahieren
      test_changes = as.numeric(
        str_extract(test_changes, "[0-9]+\\.?[0-9]*")
      )
    ) %>%
    transmute(
      sample,
      start_h = round(start_h, 2),
      test_changes,
    ) %>%
    filter(
      start_h >= 0,      
    ) %>%
    arrange(start_h)
})

print(all_samples_changes)

# Pearson r pro Sample
pearson_tbl <- all_samples_changes %>%
  group_by(sample) %>%
  summarise(
    pearson_r = cor(start_h, test_changes, method = "pearson", use = "complete.obs"),
    n = sum(complete.cases(start_h, test_changes)),
    .groups = "drop"
  )

print(pearson_tbl)

# Legenden-Labels: "sampleX (r=...)"
legend_labels <- pearson_tbl %>%
  mutate(label = paste0(sample, " (r=", sprintf("%.3f", pearson_r), ")")) %>%
  select(sample, label) %>%
  deframe()

# Plot: Farbe = sample
plot_changes <- ggplot(all_samples_changes, aes(x = start_h, y = test_changes, color = sample)) +
  geom_point(alpha = 0.7) +
  facet_wrap(~ sample, ncol = 3) + 
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
    title = "Startzeit vs. Test-Änderungsumfang",
    x = "Startzeit vor Deadline (Stunden)",
    y = "Test-Änderungsumfang (%)",
    color = "Sample"
  ) +
  theme_minimal()

print(plot_changes)

# PDF speichern
ggsave(
  filename = "startzeit_vs_test_changes_all.pdf",
  plot = plot_changes,
  width = 11,
  height = 5,
  device = cairo_pdf
)
