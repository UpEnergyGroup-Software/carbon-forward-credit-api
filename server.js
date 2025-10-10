console.clear();
require("dotenv").config();

// server.js
const express = require("express");
const bodyParser = require("body-parser");
const AWS = require("aws-sdk");
const csv = require("csv-parser");

const {
  Client,
  PrivateKey,
  AccountCreateTransaction,
  Hbar,
  CustomRoyaltyFee,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  AccountId,
  CustomFixedFee
} = require("@hashgraph/sdk");

// Configure accounts and client, and generate needed keys
const operatorId = process.env.OPERATOR_ID;
const operatorkey = PrivateKey.fromString(process.env.OPERATOR_KEY);
const treasuryId = process.env.MY_ACCOUNT_ID;
const treasurykey = PrivateKey.fromString(process.env.MY_PRIVATE_KEY);
const aliceld = AccountId.fromString(process.env.ALICE_ID);
const alicekey = PrivateKey.fromString(process.env.ALICE_PVKEY);
const bobId = AccountId.fromString(process.env.BOB_ID);
const bobkey = PrivateKey.fromString(process.env.BOB_PVKEY);

const supplykey = PrivateKey.generate();
const adminkey = PrivateKey.generate();



require("dotenv").config();
const sqlite3 = require("sqlite3").verbose();
// Initialize SQLite DB
const db = new sqlite3.Database("./tokens.db");
db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS tokens;`);
});
// Create table if not exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY,
    name TEXT,
    region TEXT,
    district TEXT,
    village TEXT,
    phone TEXT,
    serial TEXT UNIQUE,
    country TEXT,
    distribution_date TEXT,
    tokenId TEXT UNIQUE,
    account TEXT,
    for_sale BOOLEAN
  )`);
});

// Create accounts table if not exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    accountId TEXT UNIQUE,
    publicKey TEXT,
    privateKey TEXT
  )`);
});


const app = express();
const port = 3000;

app.use(bodyParser.json());


async function clientSetup() {
  // Grab your Hedera testnet account ID and private key from your env file
  const myAccountId = process.env.MY_ACCOUNT_ID;
  const myPrivateKeyStr = process.env.MY_PRIVATE_KEY;

  // If we weren't able to grab it, we should throw a new error
  if (!myAccountId || !myPrivateKeyStr) {
    throw new Error("Environment variables MY_ACCOUNT_ID and MY_PRIVATE_KEY must be present");
  }

  // Convert private key string to PrivateKey object
  const myPrivateKey = PrivateKey.fromString(myPrivateKeyStr);
  // Create your Hedera Testnet client
  const client = Client.forTestnet();
  // Set your account as the client's operator
  client.setOperator(myAccountId, myPrivateKey);
  // Set the default maximum transaction fee (in Hbar)
  client.setDefaultMaxTransactionFee(new Hbar(5));
  // Set the maximum payment for queries (in Hbar)
  client.setMaxQueryPayment(new Hbar(5));

  console.log(client)

  return client; // return the client so you can reuse it
}

const client = clientSetup();


// --------
// AAPI end points 
//----------
// 1. Root endpoint
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the API 🚀" });
});

// 2. Get all users
app.get("/users", (req, res) => {
  res.json(users);
});

// Add a new user
app.post("/users", (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }
  const newUser = { id: users.length + 1, name };
  users.push(newUser);
  res.status(201).json(newUser);
});

// accounts
app.get("/accounts", (req, res) => {
  res.json(tokens);
});

// Create a Hedera testnet account and store in DB
app.get("/accounts/create", async (req, res) => {
  try {
    // Load your operator credentials
    const operatorId = process.env.MY_ACCOUNT_ID;
    const operatorKey = process.env.MY_PRIVATE_KEY;

    // Initialize your testnet client and set operator
    const client = Client.forTestnet().setOperator(operatorId, operatorKey);

    // Generate new private/public key pair
    const newPrivateKey = await PrivateKey.generateED25519();
    const newPublicKey = newPrivateKey.publicKey;

    // Create account transaction
    const transaction = new AccountCreateTransaction()
      .setKey(newPublicKey)
      .setInitialBalance(new Hbar(10)); // give new account 10 hbar

    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);

    const newAccountId = receipt.accountId.toString();

    // Insert into SQLite DB
    db.run(
      `INSERT INTO accounts (accountId, publicKey, privateKey)
       VALUES (?, ?, ?)`,
      [newAccountId, newPublicKey.toString(), newPrivateKey.toString()],
      function (err) {
        if (err) {
          console.error("DB insert error:", err.message);
          return res.status(500).json({ error: "Failed to save account in DB" });
        }

        res.json({
          id: this.lastID,
          accountId: newAccountId,
          publicKey: newPublicKey.toString(),
          privateKey: newPrivateKey.toString(),
        });
      }
    );
  } catch (error) {
    console.error("Error creating account:", error);
    res.status(500).json({ error: "Failed to create Hedera account" });
  }
});

// query all accounts
app.get("/accounts/list", (req, res) => {
  db.all("SELECT * FROM accounts", [], (err, rows) => {
    if (err) {
      console.error("DB query error:", err.message);
      return res.status(500).json({ error: "Failed to fetch accounts" });
    }
    res.json({ count: rows.length, accounts: rows });
  });
});

// Tokens
// AWS S3 setup
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Create tokens from distribution data in S3
app.get("/tokens/create", async (req, res) => {
  try {
    const bucket = process.env.S3_BUCKET;
    const key = process.env.S3_KEY;

    // ✅ Get a fully initialized Hedera client
    const client = await clientSetup();

    // ✅ Define custom royalty + fallback fee
    const nftCustomFee = new CustomRoyaltyFee()
      .setNumerator(5)
      .setDenominator(10)
      .setFeeCollectorAccountId(treasuryId)
      .setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(200)));

    const createdTokens = [];

    const s3Stream = s3
      .getObject({ Bucket: bucket, Key: key })
      .createReadStream()
      .pipe(csv());

    s3Stream.on("data", async (row) => {
      try {
        const nftCreate = new TokenCreateTransaction()
              .setTokenName("UpEnergy Forward Credit")
              .setTokenSymbol("UPEFC")
              .setTokenType(TokenType.NonFungibleUnique)
              .setDecimals(0)
              .setInitialSupply(0)
              .setTreasuryAccountId(treasuryId)
              .setSupplyType(TokenSupplyType.Infinite)
              .setAdminKey(treasurykey.publicKey) // Admin is treasury
              .setSupplyKey(treasurykey.publicKey) // Treasury controls mint
              .setMaxTransactionFee(new Hbar(20))
              .freezeWith(client);

        const nftCreateSign = await nftCreate.sign(treasurykey);
        const nftCreateSubmit = await nftCreateSign.execute(client);
        const nftCreateRx = await nftCreateSubmit.getReceipt(client);
        const nftTokenId = nftCreateRx.tokenId.toString();

        // ✅ Prepare metadata
        const tokenMeta = {
          phone: row.phone,
          serial: row.serial
        };

        // ✅ Mint the NFT
        const mintTx = await new TokenMintTransaction()
          .setTokenId(nftTokenId)
          .setMetadata([Buffer.from(JSON.stringify(tokenMeta))])
          .setMaxTransactionFee(new Hbar(10))
          .freezeWith(client);

        const mintTxSign = await mintTx.sign(supplykey);
        const mintTxSubmit = await mintTxSign.execute(client);
        await mintTxSubmit.getReceipt(client);
        // ✅ Prepare metadata
        const tokenData = {
          id: row.id,
          name: row.name,
          region: row.region,
          district: row.district,
          village: row.village,
          phone: row.phone,
          serial: row.serial,
          country: row.country,
          distribution_date: row.distribution_date,
          tokenId: nftTokenId,
        };
        // ✅ Save to memory and SQLite
        createdTokens.push(tokenData);

        db.run(
          `INSERT OR IGNORE INTO tokens 
            (id, name, region, district, village, phone, serial, country, distribution_date, tokenId, account)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tokenData.id,
            tokenData.name,
            tokenData.region,
            tokenData.district,
            tokenData.village,
            tokenData.phone,
            tokenData.serial,
            tokenData.country,
            tokenData.distribution_date,
            tokenData.tokenId,
            treasuryId,
          ],
          (err) => {
            if (err) console.error("DB insert error:", err.message);
          }
        );
      } catch (innerErr) {
        console.error("Token creation error:", innerErr);
      }
    });

    s3Stream.on("end", () => {
      res.json({
        message: "✅ Tokens created and stored in SQLite",
        count: createdTokens.length,
        tokens: createdTokens,
      });
    });

    s3Stream.on("error", (err) => {
      console.error("S3 stream error:", err);
      res.status(500).json({ error: "Failed to read distributions from S3" });
    });
  } catch (error) {
    console.error("Error in /tokens/create:", error);
    res.status(500).json({ error: "Failed to create tokens" });
  }
});


// list all tokens put up for sale (from SQLite DB)
app.get("/tokens/market", (req, res) => {
  db.all("SELECT * FROM tokens WHERE for_sale = 1", [], (err, rows) => {
    if (err) {
      console.error("DB query error:", err.message);
      return res.status(500).json({ error: "Failed to fetch tokens for sale" });
    }
    res.json({
      count: rows.length,
      tokens: rows,
    });
  });
});


// list all tokens in my wallet (from SQLite DB)
app.get("/tokens/upenergy", (req, res) => {
  db.all("SELECT * FROM tokens", [], (err, rows) => {
    if (err) {
      console.error("DB query error:", err.message);
      return res.status(500).json({ error: "Failed to fetch tokens" });
    }
    res.json({
      count: rows.length,
      tokens: rows,
    });
  });
});


// buy token: assign token to buyer and remove from sale
app.get("/tokens/buy", (req, res) => {
  const { tokenId, buyerAccount } = req.query;

  if (!tokenId || !buyerAccount) {
    return res.status(400).json({ error: "tokenId and buyerAccount query parameters are required" });
  }

  const query = `
    UPDATE tokens
    SET for_sale = 0,
        account = ?
    WHERE tokenId = ? AND for_sale = "1"
  `;

  db.run(query, [buyerAccount, tokenId], function(err) {
    if (err) {
      console.error("DB update error:", err.message);
      return res.status(500).json({ error: "Failed to buy token" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ tokenId, status: "Token not available for sale" });
    }

    res.json({
      tokenId,
      status: `Token has been bought by account ${buyerAccount}`,
    });
  });
});


// sell token: mark a token as for sale
app.get("/tokens/sell", (req, res) => {
  const { tokenId } = req.query;

  if (!tokenId) {
    return res.status(400).json({ error: "tokenId query parameter is required" });
  }

  const query = "UPDATE tokens SET for_sale = 1 WHERE tokenId = ?";

  db.run(query, [tokenId], function(err) {
    if (err) {
      console.error("DB update error:", err.message);
      return res.status(500).json({ error: "Failed to mark token for sale" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ tokenId, status: "Token not found" });
    }

    res.json({ tokenId, status: "Token is now listed for sale" });
  });
});


app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
