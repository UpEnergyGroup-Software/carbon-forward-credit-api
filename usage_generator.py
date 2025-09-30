import boto3
import pandas as pd
from io import StringIO
import random
import datetime

from faker import Faker
fake = Faker()

# ---------- S3 CONFIG ----------
BUCKET_NAME = "hedera-hackathon"
INPUT_PREFIX = "pilot/"
OUTPUT_PREFIX = "usage/"

# ---------- HELPER FUNCTIONS ----------
def read_s3_folder(bucket_name, prefix):
    """Read all CSV files from an S3 folder into a single DataFrame."""
    s3_client = boto3.client("s3")
    
    # List all objects under the prefix
    response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
    files = [obj['Key'] for obj in response.get('Contents', []) if obj['Key'].endswith('.csv')]
    
    df_list = []
    for file_key in files:
        obj = s3_client.get_object(Bucket=bucket_name, Key=file_key)
        df = pd.read_csv(obj['Body'])
        df_list.append(df)

    if df_list:
        return pd.concat(df_list, ignore_index=True)
    else:
        return pd.DataFrame()  # empty df if no files

def write_df_to_s3(df, bucket_name, key):
    """Write dataframe to S3 as CSV."""
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False)
    
    s3_client = boto3.client("s3")
    s3_client.put_object(
        Bucket=bucket_name,
        Key=key,
        Body=csv_buffer.getvalue()
    )
    print(f" DataFrame written to s3://{bucket_name}/{key}")

# ---------- USAGE DATA GENERATOR ----------
def generate_high_freq_usage(df, past_hours=1, interval_seconds=5):
    """
    Generate electricity usage every `interval_seconds` for each device in `df`
    for the past `past_hours` hours.
    
    Columns: date, device_id, energy_kwh
    """
    usage_records = []
    now = datetime.datetime.now()
    start_time = now - datetime.timedelta(hours=past_hours)
    
    # Compute number of steps per device
    total_seconds = past_hours * 3600
    num_steps = total_seconds // interval_seconds
    
    for _, row in df.iterrows():
        device_id = f"{row['serial']}_{row['phone']}"  # unique device id
        
        for step in range(int(num_steps)):
            timestamp = start_time + datetime.timedelta(seconds=step * interval_seconds)
            energy_kwh = round(random.uniform(0.01, 0.1), 4)  # small kWh per 5-second interval
            usage_records.append({
                "date": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "device_id": device_id,
                "energy_kwh": energy_kwh
            })
    
    return pd.DataFrame(usage_records)

# ---------- MAIN WORKFLOW ----------
if __name__ == "__main__":
    # 1. Read all files from S3 folder
    df = read_s3_folder(BUCKET_NAME, INPUT_PREFIX)
    print(f"Read {len(df)} rows from S3")
    
    if df.empty:
        print("No input data found!")
    else:
        # 2. Remove duplicates based on phone and serial
        df_unique = df.drop_duplicates(subset=["phone", "serial"])
        print(f"{len(df_unique)} unique devices remaining after deduplication")
        
        # 3. Generate high-frequency electricity usage data (past 1 hour, every 5 seconds)
        usage_df = generate_high_freq_usage(df_unique, past_hours=1, interval_seconds=5)
        print(f"Generated {len(usage_df)} high-frequency usage records")
        
        # 4. Write usage data back to S3
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        s3_key = f"{OUTPUT_PREFIX}electricity_usage_{timestamp}.csv"
        write_df_to_s3(usage_df, BUCKET_NAME, s3_key)
