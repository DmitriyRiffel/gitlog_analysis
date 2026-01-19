# Falls noch nicht installiert:
# install.packages("rlang")
# install.packages(c("ggplot2", "dplyr", "readr", "tidyr"))

library(readr)
library(dplyr)
library(lubridate)
library(ggplot2)

file_path <- "F:/Hochschule/BA/gitlog_analysis/criteriaTable.csv"

# 2) CSV einlesen
df <- read_csv(file_path, show_col_types = FALSE)

# 3) Verarbeitung
result <- df %>%
  mutate(
    start_dt = dmy_hms(start_date),
    deadline_dt = dmy_hms(deadline),
    start_h = as.numeric(difftime(deadline_dt, start_dt, units = "hours")),
    author_num = parse_number(author)
  ) %>%
  transmute(
    author = author_num,
    commits = total_commits,
    start_h = round(start_h, 2)
  ) %>%
  #https://www.rdocumentation.org/packages/dplyr/versions/0.7.8/topics/filter
  filter(start_h >= 0) %>%
  arrange(start_h)

print(result)

# 4) Pearson-Korrelation
pearson_r <- cor(
  result$commits,
  result$start_h,
  method = "pearson",
  use = "complete.obs"
)

cat("Pearson-Korrelation r =", pearson_r, "\n")
out <- paste("Pearson-Korrelation r =", round(pearson_r, 3))

plot <- ggplot(result, aes(x = start_h, y = commits)) +
  geom_point() +
  labs(
    title = out,
    x = "Startzeit vor Deadline (Stunden)",
    y = "Anzahl der Commits"
  ) +
  theme_minimal()

print(plot)

ggsave(
  filename = "startzeit_vs_commits_sample3.pdf",
  plot = plot,
  width = 8,
  height = 5,
  device = cairo_pdf
)

