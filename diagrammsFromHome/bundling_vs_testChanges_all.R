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
      total_changes = as.numeric(str_match(total_changes, "\\((\\d+)\\)")[, 2]),
      test_changes = as.numeric(
        str_extract(test_changes, "[0-9]+\\.?[0-9]*")
      )
    ) %>%
    transmute(
      sample,
      bundling = as.numeric(bundling),
      test_changes,
    ) %>%
    arrange(test_changes)
})

print(all_samples_changes)

# Pearson r pro Sample
pearson_tbl <- all_samples_changes %>%
  group_by(sample) %>%
  summarise(
    pearson_r = cor(test_changes, bundling, method = "pearson", use = "complete.obs"),
    n = sum(complete.cases(test_changes, bundling)),
    .groups = "drop"
  )

print(pearson_tbl)

# Legenden-Labels: "sampleX (r=...)"
legend_labels <- pearson_tbl %>%
  mutate(label = paste0(sample, " (r=", sprintf("%.3f", pearson_r), ")")) %>%
  select(sample, label) %>%
  deframe()

# Plot: Farbe = sample
plot_changes <- ggplot(all_samples_changes, aes(x = bundling, y = test_changes, color = sample)) +
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
    title = "Test-Änderungsumfang vs. Commit-Bündelung",
    x = "Bündelung (0-1)",
    y = "Test-Änderungsumfang",
    color = "Sample"
  ) +
  theme_minimal()

print(plot_changes)

# PDF speichern
ggsave(
  filename = "bundling_vs_testChanges_all.pdf",
  plot = plot_changes,
  width = 11,
  height = 5,
  device = cairo_pdf
)
