library(readr)
library(dplyr)
library(lubridate)
library(ggplot2)
library(stringr)

file_path <- "F:/Hochschule/BA/gitlog_analysis/criteriaTable.csv"

# CSV einlesen
df <- read_csv(file_path, show_col_types = FALSE)

# Verarbeitung
result <- df %>%
  mutate(
    start_dt = dmy_hms(start_date),
    deadline_dt = dmy_hms(deadline),
    start_h = as.numeric(difftime(deadline_dt, start_dt, units = "hours")),
    
    # Prozentwert aus "74.80 % (1475)" extrahieren
    test_changes_pct = as.numeric(
      str_extract(test_changes, "[0-9]+\\.?[0-9]*")
    )
  ) %>%
  transmute(
    start_h = round(start_h, 2),
    test_changes_pct
  ) %>%
  filter(
    start_h >= 0,
    !is.na(test_changes_pct)
  ) %>%
  arrange(start_h)

print(result)

# Pearson-Korrelation
pearson_r <- cor(
  result$start_h,
  result$test_changes_pct,
  method = "pearson",
  use = "complete.obs"
)

cat("Pearson-Korrelation r =", pearson_r, "\n")
out <- paste("start_date & test_changes. Pearson-Korrelation r =", round(pearson_r, 3))

# Plot
plot <- ggplot(result, aes(x = start_h, y = test_changes_pct)) +
  geom_point() +
  labs(
    title = out,
    x = "Startzeit vor Deadline (Stunden)",
    y = "Teständerungen (%)"
  ) +
  theme_minimal()

print(plot)

# PDF speichern
ggsave(
  filename = "startzeit_vs_test_changes_sample1.pdf",
  plot = plot,
  width = 8,
  height = 5,
  device = cairo_pdf
)
