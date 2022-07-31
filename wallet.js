const EC = require("elliptic").ec;
const fs = require("fs");

const ec = new EC("secp256k1");
const privateKeyLocation = __dirname + "/wallet/private_key";

exports.initWallet = () => {
  let privateKey;

  if (fs.existsSync(privateKeyLocation)) {
    const buffer = fs.readFileSync(privateKeyLocation, "utf-8");
    privateKey = buffer.toString();
  } else {
    privateKey = generatePrivateKey();
    fs.writeFileSync(privateKeyLocation, privateKey);
  }
};

const generatePrivateKey = () => {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

//let wallet = this;
//let retVal = wallet.initWallet();
//console.log(JSON.stringify(retVal));
