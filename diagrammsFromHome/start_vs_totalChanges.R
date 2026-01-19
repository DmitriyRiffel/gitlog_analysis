library(readr)
library(dplyr)
library(lubridate)
library(ggplot2)
library(stringr)

file_path <- "F:/Hochschule/BA/gitlog_analysis/criteriaTable_sample1.csv"

# CSV einlesen
df <- read_csv(file_path, show_col_types = FALSE)

# Verarbeitung
result <- df %>%
  mutate(
    start_dt = dmy_hms(start_date),
    deadline_dt = dmy_hms(deadline),
    start_h = as.numeric(difftime(deadline_dt, start_dt, units = "hours")),
    
    # Zahl in Klammern aus "100.00% (271)" extrahieren -> 271
    total_changes_n = as.numeric(str_match(total_changes, "\\((\\d+)\\)")[, 2])
  ) %>%
  transmute(
    start_h = round(start_h, 2),
    total_changes_n
  ) %>%
  filter(
    start_h >= 0,
    !is.na(total_changes_n)
  ) %>%
  arrange(start_h)

print(result)

# Pearson-Korrelation
pearson_r <- cor(
  result$start_h,
  result$total_changes_n,
  method = "pearson",
  use = "complete.obs"
)

cat("Pearson-Korrelation r =", pearson_r, "\n")
out <- paste("start_date & total_changes. Pearson-Korrelation r =", round(pearson_r, 3))

# Plot
plot <- ggplot(result, aes(x = start_h, y = total_changes_n)) +
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
  filename = "startzeit_vs_total_changes_sample1.pdf",
  plot = plot,
  width = 8,
  height = 5,
  device = cairo_pdf
)
