const {
  Client,
  PrivateKey,
  AccountCreateTransaction,
  AccountBalanceQuery,
  Hbar,
  TransferTransaction
} = require("@hashgraph/sdk");
require("dotenv").config();

async function environmentSetup() {
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

environmentSetup();
