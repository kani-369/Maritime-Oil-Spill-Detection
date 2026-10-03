"""Lightweight CSV / JSON logging helpers."""

import csv
import json
import os


def write_dict_to_json(file_json, dict_data):
    with open(file_json, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(dict_data, indent=4))


def load_dict_from_json(file_json):
    with open(file_json) as fh:
        return json.load(fh)


class CSVWriter:
    """Append rows of training/evaluation metrics to a CSV file."""

    def __init__(self, file_name, column_names, append=False, completed_epoch=None):
        self.file_name = file_name
        self.column_names = column_names

        if append and os.path.isfile(self.file_name) and os.path.getsize(self.file_name) > 0:
            with open(self.file_name, "r", newline="", encoding="utf-8") as fh:
                existing_rows = list(csv.reader(fh))

            header = existing_rows[0] if existing_rows else self.column_names
            valid_rows = []
            for row in existing_rows[1:]:
                if not row:
                    continue
                if completed_epoch is not None:
                    try:
                        ep = int(row[0])
                        if ep > completed_epoch:
                            continue
                    except (ValueError, IndexError):
                        pass
                valid_rows.append(row)

            with open(self.file_name, "w", newline="", encoding="utf-8") as fh:
                writer = csv.writer(fh)
                writer.writerow(header)
                for row in valid_rows:
                    writer.writerow(row)
                fh.flush()

            self.file_handle = open(self.file_name, "a", newline="", encoding="utf-8")
            self.writer = csv.writer(self.file_handle)
            print(f"{self.file_name} opened in append mode (preserved {len(valid_rows)} epochs)")
        else:
            self.file_handle = open(self.file_name, "w", newline="", encoding="utf-8")
            self.writer = csv.writer(self.file_handle)
            self.write_header()
            print(f"{self.file_name} created successfully with header row")

    def write_header(self):
        self.write_row(self.column_names)

    def write_row(self, row):
        self.writer.writerow(row)
        self.file_handle.flush()

    def close(self):
        self.file_handle.close()
