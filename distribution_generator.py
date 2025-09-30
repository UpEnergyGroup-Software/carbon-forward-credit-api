from faker import Faker
import random
import pandas as pd
import datetime
import boto3
from io import StringIO
import time


fake = Faker()

BUCKET_NAME = "hedera-hackathon"
S3_FOLDER = "distributions"
PILOT_S3_FOLDER = "pilot"
INTERVAL_SECONDS = 15 * 60  # 15 minutes

# Location hierarchy: Country -> Region -> District -> Villages
locations = {
    "Uganda": {
        "Central": {
            "Wakiso": ["Kira", "Kasangati", "Nansana"],
            "Kampala": ["Makindye", "Kawempe", "Rubaga"]
        },
        "Eastern": {
            "Mbale": ["Namatala", "Naboa"],
            "Soroti": ["Arapai", "Katine"]
        }
    },
    "Kenya": {
        "Nairobi": {
            "Westlands": ["Kangemi", "Kileleshwa"],
            "Kasarani": ["Mwiki", "Garden Estate"]
        },
        "Coast": {
            "Mombasa": ["Likoni", "Nyali"],
            "Kwale": ["Diani", "Ukunda"]
        }
    },
    "Tanzania": {
        "Dar es Salaam": {
            "Ilala": ["Kariakoo", "Buguruni"],
            "Kinondoni": ["Mwenge", "Mikocheni"]
        }
    },
    "Zambia": {
        "Lusaka": {
            "Lusaka": ["Matero", "Kabwata"]
        }
    },
    "Malawi": {
        "Southern": {
            "Blantyre": ["Ndirande", "Chilomoni"]
        }
    },
    "Nigeria": {
        "South West": {
            "Lagos": ["Ikeja", "Yaba", "Surulere"]
        },
        "North Central": {
            "Abuja": ["Wuse", "Garki"]
        }
    },
    "Ghana": {
        "Greater Accra": {
            "Accra": ["Osu", "Madina", "Kaneshie"]
        }
    },
    "Mozambique": {
        "Maputo": {
            "Maputo": ["Polana", "Bairro Central"]
        }
    },
    "Cameroon": {
        "Centre": {
            "Yaoundé": ["Biyem-Assi", "Mvan"]
        }
    }
}

# Country phone codes & patterns
phone_codes = {
    "Uganda": "+2567########",
    "Kenya": "+2547########",
    "Tanzania": "+2557########",
    "Zambia": "+2609#######",
    "Malawi": "+2659#######",
    "Nigeria": "+2348#######",
    "Ghana": "+2335#######",
    "Mozambique": "+2588#######",
    "Cameroon": "+2376#######"
}

def generate_phone(country):
    """Generate phone number using defined country patterns."""
    pattern = phone_codes[country]
    number = ""
    for char in pattern:
        if char == "#":
            number += str(random.randint(0, 9))
        else:
            number += char
    return number

def generate_upenergy_data(n=10):
    """Generate fake UpEnergy-style distribution dataset."""
    data = []

    for i in range(n):
        country = random.choice(list(locations.keys()))
        region = random.choice(list(locations[country].keys()))
        district = random.choice(list(locations[country][region].keys()))
        village = random.choice(locations[country][region][district])
        phone = generate_phone(country)

        record = {
            "id": i + 1,
            "name": fake.name(),
            "region": region,
            "district": district,
            "village": village,
            "phone": phone,
            "serial": fake.bothify(text="SN-#####-????"),
            "country": country,
            "distribution_date": fake.date_between(
                start_date=datetime.date(2024, 1, 1),
                end_date=datetime.date.today()
            ).strftime("%Y-%m-%d")
        }
        data.append(record)

    return pd.DataFrame(data)

def write_df_to_s3(df, bucket_name, key, pilot_key, aws_access_key_id=None, aws_secret_access_key=None, aws_region="us-east-1"):
    """
    Write dataframe to S3 as CSV.
    
    Args:
        df (pd.DataFrame): DataFrame to upload
        bucket_name (str): S3 bucket name
        key (str): S3 object key (e.g. 'folder/data.csv')
        aws_access_key_id (str, optional): AWS access key
        aws_secret_access_key (str, optional): AWS secret key
        aws_region (str): AWS region, default 'us-east-1'
    """
    
    # Convert dataframe to CSV in-memory
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False)
    
    # Create S3 client
    if aws_access_key_id and aws_secret_access_key:
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=aws_region
        )
    else:
        # Use credentials from environment / IAM role
        s3_client = boto3.client("s3", region_name=aws_region)
    
    # Upload to S3
    s3_client.put_object(
        Bucket=bucket_name,
        Key=key,
        Body=csv_buffer.getvalue()
    )
    
    print(f"✅ DataFrame written to s3://{bucket_name}/{key}")


    # selecting data for pilot
    # Convert dataframe to CSV in-memory
    nn = int(len(df)*0.1)

    csv_buffer = StringIO()
    df.head(nn).to_csv(csv_buffer, index=False)
    
    # Create S3 client
    if aws_access_key_id and aws_secret_access_key:
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=aws_region
        )
    else:
        # Use credentials from environment / IAM role
        s3_client = boto3.client("s3", region_name=aws_region)
    
    # Upload to S3
    s3_client.put_object(
        Bucket=bucket_name,
        Key=pilot_key,
        Body=csv_buffer.getvalue()
    )
    
    print(f"✅ Pilot DataFrame written to s3://{bucket_name}/{key}")

def run():
    # Generate data
    df = generate_upenergy_data(100)
    print(df)
    
    # Create unique filename with timestamp
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    s3_key = f"{S3_FOLDER}/data_{timestamp}.csv"
    pilot_key = f"{PILOT_S3_FOLDER}/data_{timestamp}.csv"
    
    # Upload to S3
    write_df_to_s3(df, bucket_name=BUCKET_NAME, key=s3_key, pilot_key=pilot_key)
    
    print("Next upload in 15 minutes...\n")
    
    # Wait 15 minutes
    time.sleep(INTERVAL_SECONDS)

# Example usage
if __name__ == "__main__":
    run()
