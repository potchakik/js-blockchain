const crypto = require("crypto");
const Swarm = require("discovery-swarm");
const defaults = require("dat-swarm-defaults");
const getPort = require("get-port");
const chain = require("./chain");
const cron = require("cron");

const peers = {};
let connSeq = 0;

let channel = "myBlockchain";

let registeredMiners = [];
let lastBlockMinedBy = null;

let MessageType = {
  REQUEST_BLOCK: "requestBlock",
  RECEIVE_NEXT_BLOCK: "receiveNextBlock",
  RECEIVE_NEW_BLOCK: "receiveNewBlock",
  REQUEST_ALL_REGISTER_MINERS: "requestAllRegisterMiners",
  REGISTER_MINER: "registerMIner",
};

const myPeerId = crypto.randomBytes(32);
console.log("myPeerId: " + myPeerId.toString("hex"));

const config = defaults({
  id: myPeerId,
});

const swarm = Swarm(config);
//console.log(swarm);

(async () => {
  const port = await getPort();

  swarm.listen(port);
  console.log("Listening Port: " + port);

  swarm.join(channel);
  swarm.on("connection", (conn, info) => {
    const seq = connSeq;
    const peerId = info.id.toString("hex");
    console.log(`Connected #${seq} to peer: ${peerId}`);

    if (info.initiator) {
      try {
        conn.setKeepAlive(true, 600);
      } catch (exeption) {
        console.log("exeption", exeption);
      }
    }

    conn.on("data", (data) => {
      let message = JSON.parse(data);
      console.log("--------Received Message Start ---------");
      console.log(
        "from: " + peerId.toString("hex"),
        "to: " + peerId.toString(message.to),
        "my: " + myPeerId.toString("hex"),
        "type: " + JSON.stringify(message.type)
      );

      console.log("--------Received Message End ---------");

      switch (message.type) {
        case MessageType.REQUEST_BLOCK:
          console.log("-----------REQUEST_BLOCK-------------");
          let requestedIndex = JSON.parse(JSON.stringify(message.data)).index;
          let requestedBlock = chain.getBlock(requestedIndex);
          if (requestedBlock)
            writeMessageToPeerToId(
              peerId.toString("hex"),
              MessageType.RECEIVE_NEXT_BLOCK
            );
          else console.log("No block found @ index: " + requestedIndex);
          console.log("-----------REQUEST_BLOCK-------------");
          break;

        case MessageType.RECEIVE_NEXT_BLOCK:
          console.log("-----------RECEIVE_NEXT_BLOCK-------------");
          chain.addBlock(JSON.parse(JSON.stringify(message.data)));
          console.log(JSON.stringify(chain.blockchain));
          let nextBlockIndex = chain.getLatestBlock().index + 1;
          console.log("-- request next block @ index: " + nextBlockIndex);
          writeMessageToPeers(MessageType.REQUEST_BLOCK, {
            index: nextBlockIndex,
          });
          console.log("-----------RECEIVE_NEXT_BLOCK-------------");
          break;

        case MessageType.REQUEST_ALL_REGISTER_MINERS:
          console.log(
            " — — — — — -REQUEST_ALL_REGISTER_ MINERS — — — — — — — " +
              message.to
          );
          writeMessageToPeers(MessageType.REGISTER_MINER, registeredMiners);
          registeredMiners = JSON.parse(JSON.stringify(message.data));
          console.log(
            " — — — — — -REQUEST_ALL_REGISTER_ MINERS — — — — — — — " +
              message.to
          );
          break;

        case MessageType.REGISTER_MINER:
          console.log(" — — — — — -REGISTER_MINER — — — — — — — " + message.to);
          let miners = JSON.stringify(message.data);
          registeredMiners = JSON.parse(miners);
          console.log(registeredMiners);
          console.log("----------- REGISTER_MINER------------- " + message.to);
          break;
      }
    });

    conn.on("close", () => {
      console.log(`Connection ${seq} closed,peerId: ${peerId}`);

      if (peers[peerId].seq === seq) {
        delete peers[peerId];
        console.log(
          " — — registeredMiners before: " + JSON.stringify(registeredMiners)
        );
        let index = registeredMiners.indexOf(peerId);
        if (index > -1) registeredMiners.splice(index, 1);
        console.log(
          " — — registeredMiners end: " + JSON.stringify(registeredMiners)
        );
      }
    });

    if (!peers[peerId]) {
      peers[peerId] = {};
    }
    peers[peerId].conn = conn;
    peers[peerId].seq = seq;
    connSeq++;
  });
})();

// using a setTimeout Node.js native function to send a message after ten seconds to any available peers
setTimeout(function () {
  writeMessageToPeers("hello", null);
}, 10000);

// writeMessageToPeers method will be sending messages to all the connected peers
writeMessageToPeers = (type, data) => {
  for (let id in peers) {
    console.log("-------- writeMessageToPeers start -------- ");
    console.log("type: " + type + ", to: " + id);
    console.log("-------- writeMessageToPeers end ----------- ");
    sendMessage(id, type, data);
  }
};

// writeMessageToPeerToId, that will be sending the message to a specific peer ID
writeMessageToPeerToId = (toId, type, data) => {
  for (let id in peers) {
    if (id === toId) {
      console.log("-------- writeMessageToPeerToId start -------- ");
      console.log("type: " + type + ", to: " + toId);
      console.log("-------- writeMessageToPeerToId end ----------- ");
      sendMessage(id, type, data);
    }
  }
};

/* 
   sendMessage is a generic method that we will be using to send a
   message formatted with the params you would like to pass and includes the
   following:
     – to/from: The peer ID you are sending the message from and to
     – type: The message type
     – data: Any data you would like to share on the P2P network 
*/

sendMessage = (id, type, data) => {
  peers[id].conn.write(
    JSON.stringify({
      to: id,
      from: myPeerId,
      type: type,
      data: data,
    })
  );
};

setTimeout(function () {
  writeMessageToPeers(MessageType.REQUEST_ALL_REGISTER_MINERS, null);
}, 5000);

setTimeout(function () {
  writeMessageToPeers(MessageType.REQUEST_BLOCK, {
    index: chain.getLatestBlock().index + 1,
  });
}, 5000);

setTimeout(function () {
  registeredMiners.push(myPeerId.toString("hex"));
  console.log(" — — — — — Register my miner — — — — — — — ");
  console.log(registeredMiners);
  writeMessageToPeers(MessageType.REGISTER_MINER, registeredMiners);
  console.log(" — — — — — Register my miner — — — — — — — ");
}, 7000);

const job = new cron.CronJob("30 * * * * *", function () {
  let index = 0;

  if (lastBlockMinedBy) {
    let newIndex = registerMiners.indexOf(lastBlockMinedBy);
    index = newIndex + 1 > registeredMiners.length - 1 ? 0 : newIndex + 1;
  }

  lastBlockMinedBy = registeredMiners[index];
  console.log(
    "-- REQUESTING NEW BLOCK FROM: " +
      registeredMiners[index] +
      ", index: " +
      index
  );
  console.log(JSON.stringify(registeredMiners));

  if (registeredMiners[index] === myPeerId.toString("hex")) {
    console.log("-----------create next block -----------------");
    let newBlock = chain.generateNextBlock(null);
    chain.addBlock(newBlock);
    console.log(JSON.stringify(newBlock));
    writeMessageToPeers(MessageType.RECEIVE_NEW_BLOCK, newBlock);
    console.log(JSON.stringify(chain.blockchain));
    console.log("-----------create next block -----------------");
  }
});

job.start();
