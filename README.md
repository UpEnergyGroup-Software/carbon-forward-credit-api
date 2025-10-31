
# UpEnergy Hedera Token Platform

This repository contains scripts and an API to simulate **distribution and usage data** for clean cooking devices across Africa, generate **digital tokens** representing forward carbon credits on Hedera Testnet, and manage a **token marketplace**.

---

## Table of Contents

* [Project Overview](#project-overview)
* [Distributions Data](#distributions-data)
* [Usage Data](#usage-data)
* [API](#api)

  * [General](#general)
  * [Accounts](#accounts)
  * [Tokens](#tokens)
* [Requirements](#requirements)
* [Setup](#setup)
* [Running the Scripts](#running-the-scripts)
* [License](#license)

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
Pitch Deck 

https://docs.google.com/presentation/d/1XqwY-jUt651lJ0u_RnnKsCWawd7Yx2DxCPmRry4FoFw/edit?usp=sharing

Certificates

Andrew -  https://certs.hashgraphdev.com/c8ef1195-1976-44c0-b33c-6bd8a18bc752.pdf

Azeite - https://certs.hashgraphdev.com/e9693ed4-2655-4c85-b28e-0e3064588e11.pdf

Dalmas - https://certs.hashgraphdev.com/a80b3fea-6581-4fc3-85b6-8d57613b7cfb.pdf

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
```

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
All endpoints are prefixed with `http://localhost:3000`.

---

### General

#### **GET /**

Returns a welcome message to verify the API is running.

**Example Response:**

```json
{ "message": "Welcome to the API 🚀" }
```

---

### Accounts

Endpoints for managing **Hedera accounts**.

#### **GET /accounts**

Returns mock in-memory accounts (mainly for testing/demo).

---

#### **GET /accounts/create**

Creates a new Hedera Testnet account and stores it in SQLite.
Each account is created with 10 test HBAR and returns its keys.

**Response:**

```json
{
  "id": 1,
  "accountId": "0.0.34567",
  "publicKey": "302a300506032b6570032100...",
  "privateKey": "302e020100300506032b6570..."
}
```

---

#### **GET /accounts/list**

Lists all accounts that have been created and saved in the database.

**Response:**

```json
{
  "count": 2,
  "accounts": [
    {
      "id": 1,
      "accountId": "0.0.34567",
      "publicKey": "302a300506032b6570032100...",
      "privateKey": "302e020100300506032b6570..."
    },
    {
      "id": 2,
      "accountId": "0.0.67890",
      "publicKey": "302a300506032b6570032100...",
      "privateKey": "302e020100300506032b6570..."
    }
  ]
}
```

---

### Tokens

Endpoints for generating, listing, and trading tokens.

#### **GET /tokens/create**

Reads distribution data from S3 and creates tokens.
Each token is tied to a device serial and stored in SQLite.

**Response:**

```json
{
  "message": "✅ Tokens created and stored in SQLite",
  "count": 10,
  "tokens": [ { "tokenId": "TOKEN-1234", ... } ]
}
```

---

#### **GET /tokens/upenergy**

Lists all tokens created by UpEnergy (from SQLite).

**Response:**

```json
{
  "count": 50,
  "tokens": [ { "tokenId": "TOKEN-1234", ... } ]
}
```

---

#### **GET /tokens/market**

Lists all tokens currently available for sale (`for_sale = 1`).

**Response:**

```json
{
  "count": 3,
  "tokens": [ { "tokenId": "TOKEN-9876", "for_sale": 1, ... } ]
}
```

---

#### **GET /tokens/sell?tokenId=TOKEN-ID**

Marks a token as **for sale**.
`tokenId` is required.

**Response:**

```json
{
  "tokenId": "TOKEN-XYZ",
  "status": "Token is now listed for sale"
}
```

---

#### **GET /tokens/buy?tokenId=TOKEN-ID&buyerAccount=ACCOUNT**

Allows a buyer account to purchase a token.
The token is reassigned to the buyer and removed from sale.

**Response:**

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
