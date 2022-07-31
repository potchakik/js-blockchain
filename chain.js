const Block = require("./block").Block;
const BlockHeader = require("./block").BlockHeader;
const moment = require("moment");
const CryptoJS = require("crypto-js");
const { Level } = require("level");
const fs = require("fs");
let db;

const blockchain = [genesisBlock()];

let createDb = (peerId) => {
  let dir = __dirname + "/db/" + peerId;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    db = new Level(dir);
    storeBlock(getGenesisBlock());
  }
};

let getGenesisBlock = () => {
  let blockHeader = new BlockHeader(
    1,
    null,
    "0x1bc1100000000000000000000000000000000000000000000",
    moment().unix(),
    "0x171b7320",
    "1CAD2B8C"
  );
  return new Block(blockHeader, 0, null);
};

let getLatestBlock = () => blockchain[blockchain.length - 1];

let addBlock = (newBlock) => {
  let prevBlock = getLatestBlock();
  if (
    prevBlock.index < newBlock.index &&
    newBlock.blockHeader.previousBlockHeader ===
      prevBlock.blockHeader.merkleRoot
  ) {
    blockchain.push(newBlock);
  }
};

let getDbBlock = (index, res) => {
  db.get(index, function (err, value) {
    if (err) return res.send(JSON.stringify(err));
    return res.send(value);
  });
};

let getBlock = (index) => {
  if (blockchain.length - 1 >= index) return blockchain[index];
  else return null;
};

const generateNextBlock = (txns) => {
  const prevBlock = getLatestBlock(),
    prevMerkleRoot = prevBlock.blockHeader.merkleRoot;
  (nextIndex = prevBlock.index + 1),
    (nextTime = moment().unix()),
    (nextMerkleRoot = CryptoJS.SHA256(1, prevMerkleRoot, nextTime).toString());

  const blockHeader = new BlockHeader(
    1,
    prevMerkleRoot,
    nextMerkleRoot,
    nextTime
  );
  const newBlock = new Block(blockHeader, nextIndex, txns);
  blockchain.push(newBlock);
  storeBlock(newBlock);
  return newBlock;
};

if (typeof exports != "undefined") {
  exports.addBlock = addBlock;
  exports.getBlock = getBlock;
  exports.blockchain = blockchain;
  exports.getLatestBlock = getLatestBlock;
  exports.generateNextBlock = generateNextBlock;
  exports.createDb = createDb;
  exports.getDbBlock = getDbBlock;
}
