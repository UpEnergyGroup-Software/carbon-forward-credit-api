
# UpEnergy Hedera Token Platform

This repository contains scripts and an API to simulate **distribution and usage data** for clean cooking devices across Africa, generate **digital tokens** representing forward carbon credits on Hedera Testnet, and manage a **token marketplace**.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Distributions Data](#distributions-data)
- [Usage Data](#usage-data)
- [API](#api)
  - [Accounts](#accounts)
  - [Tokens](#tokens)
- [Requirements](#requirements)
- [Setup](#setup)
- [Running the Scripts](#running-the-scripts)
- [License](#license)

---

## Project Overview

UpEnergy distributes clean cooking technology and captures baseline and usage data to compute avoided CO₂e.  

This project demonstrates a **blockchain-backed solution** using Hedera:

1. **Generate distribution data** with locations, serials, and contact information.  
2. **Simulate usage data** (electricity consumption) for each device.  
3. **Create digital tokens** representing a claim on future carbon credits.  
4. **Trade tokens** in a simple marketplace via an API.  

Tokens are **stored in SQLite**, while raw and processed data can be stored on **AWS S3**.

---

## Distributions Data

Distributions data can be generated using the `distributions.py` script:

```python
from faker import Faker
import random
import pandas as pd
import datetime
import boto3
from io import StringIO
import time
````

* Generates fake users across multiple African countries, regions, districts, and villages.
* Generates unique device serial numbers and phone numbers.
* Uploads full and pilot datasets to **S3** in CSV format.

**Key features:**

* `generate_upenergy_data(n)` → creates `n` fake distribution records.
* `write_df_to_s3(df, bucket_name, key, pilot_key)` → uploads full dataset and pilot subset to S3.

**Upload interval:** every 15 minutes.

---

## Usage Data

Usage data simulates high-frequency electricity readings from devices:

```python
# Columns: date, device_id, energy_kwh
```

* Reads device distributions from S3 (`pilot/` folder).
* Removes duplicates based on `phone` and `serial`.
* Generates usage every 5 seconds for the past hour.
* Uploads generated usage data to S3 (`usage/` folder).

---

## API

The API is built with **Node.js (Express)** and interacts with **Hedera Testnet** and **SQLite**.

### Accounts

* **GET /**
  Welcome message.

* **GET /accounts**
  List all accounts (mock data).

* **GET /accounts/create**
  Create a Hedera Testnet account. Returns:

  ```json
  {
    "accountId": "0.0.xxxxx",
    "publicKey": "...",
    "privateKey": "..."
  }
  ```

### Tokens

* **GET /tokens/create**
  Read distributions from S3 and generate tokens. Tokens are inserted into SQLite.

* **GET /tokens/upenergy**
  Returns all tokens stored in SQLite.

* **GET /tokens/market**
  Returns all tokens currently listed for sale (`for_sale = 1`).

* **GET /tokens/sell?tokenId=TOKEN-ID**
  Mark a token as for sale. Returns:

  ```json
  {
    "tokenId": "TOKEN-XYZ",
    "status": "Token is now listed for sale"
  }
  ```

* **GET /tokens/buy?tokenId=TOKEN-ID&buyerAccount=ACCOUNT**
  Buy a token: assigns it to the buyer and removes it from sale. Returns:

  ```json
  {
    "tokenId": "TOKEN-XYZ",
    "status": "Token has been bought by account 0.0.1234"
  }
  ```

---

## Requirements

* Node.js >= 18
* Python 3.9+
* SQLite3
* AWS credentials configured in environment variables or IAM role
* `.env` file for Hedera credentials:

```env
MY_ACCOUNT_ID=0.0.xxxxx
MY_PRIVATE_KEY=302e020100300506032b657004220420...
S3_BUCKET=hedera-hackathon
S3_KEY=distributions/distributions.csv
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## Setup

1. Clone the repo:

```bash
git clone <repo-url>
cd <repo-folder>
```

2. Install Node.js dependencies:

```bash
npm install
```

3. Install Python dependencies:

```bash
pip install pandas faker boto3
```

4. Create `.env` file with Hedera & AWS credentials (see above).

---

## Running the Scripts

**Distributions generator (Python):**

```bash
python distributions.py
```

**Usage data generator (Python):**

```bash
python usage.py
```

**Start API (Node.js):**

```bash
node server.js
```

API runs on: `http://localhost:3000`

---

## License

@UpEnergy

