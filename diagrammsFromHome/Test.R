library(readr)
library(dplyr)
library(lubridate)
library(purrr)
library(stringr)
library(tibble)

dir_path <- "F:/Hochschule/BA/gitlog_analysis"

files <- list.files(
  path = dir_path,
  pattern = "^criteriaTable_sample\\d+\\.csv$",
  full.names = TRUE
)

late_hours <- 12      
commits_threshold <- 8  

all_samples <- map_dfr(files, function(fp) {
  df <- read_csv(fp, show_col_types = FALSE)
  
  df %>%
    mutate(
      sample = str_extract(basename(fp), "sample\\d+"),
      start_dt = dmy_hms(start_date),
      deadline_dt = dmy_hms(deadline),
      start_h = as.numeric(difftime(deadline_dt, start_dt, units = "hours"))
    ) %>%
    transmute(
      sample,
      start_h,
      total_commits
    ) %>%
    filter(
      !is.na(start_h),
      !is.na(total_commits)
    )
})

# Flags bauen
df_flags <- all_samples %>%
  mutate(
    start_late  = start_h <= late_hours,
    commits_low = total_commits < commits_threshold
  )

# ====== 90%-Aussage pro Sample ======
rule_tbl <- df_flags %>%
  group_by(sample) %>%
  summarise(
    n_total = n(),
    n_late = sum(start_late),
    n_late_and_low = sum(start_late & commits_low),
    p_low_given_late = ifelse(n_late > 0, n_late_and_low / n_late, NA_real_),
    # optional: baseline (wie oft "low commits" generell vorkommt)
    baseline_low = mean(commits_low),
    lift = ifelse(!is.na(p_low_given_late) & baseline_low > 0, p_low_given_late / baseline_low, NA_real_),
    .groups = "drop"
  )

print(rule_tbl)

# Optional: insgesamt über alle Samples
overall <- df_flags %>%
  summarise(
    n_total = n(),
    n_late = sum(start_late),
    n_late_and_low = sum(start_late & commits_low),
    p_low_given_late = ifelse(n_late > 0, n_late_and_low / n_late, NA_real_),
    baseline_low = mean(commits_low),
    lift = ifelse(!is.na(p_low_given_late) & baseline_low > 0, p_low_given_late / baseline_low, NA_real_)
  )

print(overall)