const {
    grid,
    wrap
} = require('./grid')
const {
    UserRole,
    defaultRole,
    roles
} = require('./roles')
//const { Worker } = require('worker_threads')

// Launch command reader on seperate thread
function setupCommandIso() {
    /*console.log("Setting up seperate command thread...");
    const worker = new Worker('./getStdin.js');*/
    process.stdin.on('data', (message) => {
        message = message.toString()
        message = message.split('').slice(0,message.length-1).join('')
        var cmd = message.split(' ')[0];
        var args = message.split(' ').slice(1);
        execCmd(cmd, args);
    });
    /*worker.on('error', function(error){
        console.log(error)
    });
    worker.on('exit', (code) => {
      console.log('Worker stopped with exit code '+code)
    })*/
}

// Run a command on main thread
async function execCmd(cmd, args) {
  const {webSockets} = require('./index')
  if (cmd == "set-cell") {
    var x = int.parse(args[0]);
    var y = int.parse(args[1]);
    var id = args[2];
    var rot = int.parse(args[3]);
    var data = parseCellDataStr(args[4]);

    console.log(`Placed cell at ${x},${y} to ID: ${id} ROT: ${rot} DATA: ${data}`);

    grid()[x][y].id = id;
    grid()[x][y].rot = rot;
    for (let ws of webSockets()) {
      ws.send(`place ${x} ${y} ${id} ${rot} ${args[4]}`);
    }
    gridCache = null;
  } else if (cmd == "set-bg") {
    var x = int.parse(args[0]);
    var y = int.parse(args[1]);
    var id = args[2];

    console.log(`Placed background at ${x},${y} to ID: ${id}`);

    grid()[x][y].bg = id;
    for (let ws of webSockets()) {
      ws.send(`bg ${x} ${y} ${id}`);
    }
    gridCache = null;
  } /*else if (cmd == "toggle-wrap") {
    wrap = !wrap;
    for (let ws of webSockets()) {
      ws.send("wrap");
    }
    console.log(`Toogled wrap mode (${wrap ? "ON" : "OFF"})`);
    gridCache = null;
  } */else if (cmd == "set-grid") {
    if (gridCache != args.join(" ")) {
      loadStr(args.join(" "));
      for (let ws of webSockets()) {
        ws.send('setinit ' + args.join(" "));
      }
      gridCache = args.join(" ");
    }
    console.log("Sucessfully changed grid");
  } else if (cmd == "kick-user" || cmd == "kick") {
    var user;
    const {clientIDs} = require('./index')
    for (let ws of webSockets()) {
      if (clientIDs[ws] == args[0]) {
        user = ws;
      }
    }
    if (user != undefined) {
      kickWS(user);
    } else {
      console.log(`User ${args[0]} does not exist.`);
    }
  } else if (cmd == "list-users") {
    const {clientIDs} = require('./index')
    if (webSockets() == []) {
      console.log("No users are connected");
    }
    for (let ws of webSockets()) {
      console.log(clientIDs[ws] ?? "Pending User");
    }
  } else if (cmd == "list-cursors") {
    if (cursors == []) {
      console.log("No cursors exist");
    }
    cursors.forEach(
      (id, cursor) => {
        console.log(`OWNER: ${id} X: ${cursor.x} Y: ${cursor.y}`);
      },
    );
  } else if (cmd == "list-hovers") {
    if (hovers == []) {
      console.log("No hovers exist");
    }
    hovers.forEach(
      (id, hover) => {
        console.log(
          `OWNER: ${id} X: ${hover.x} Y: ${hover.y} CARRIED ID: ${hover.id} CARRIED ROT: ${hover.rot}`,
        );
      },
    );
  } else if (cmd == "direct-send" || cmd == "send") {
    var packet = args.join(" ");

    for (let ws of webSockets()) {
      ws.send(packet);
    }
  } else if (cmd == "exit" || cmd == "e") {
    process.exit(0);
  } else if (cmd == "default-role") {
    console.log(defaultRole.toString().replaceAll("UserRole.", ""));
  } else if (cmd == "set-default-role") {
    if (getRoleStr(args[0]) != null) defaultRole = getRoleStr(args[0]);
  } else if (cmd == "set-user-role") {
    if (getRoleStr(args[1]) != null) roles[args[0]] = getRoleStr(args[1]);
  } else if (cmd == "user-roles") {
    roles().forEach((id, role) => {
      console.log(`${id} - ${role.toString().replaceAll("UserRole.", "")}`);
    });
  } else if (cmd == "help" || cmd == "h") {
    console.log('set-cell <x> <y> <id> <rot> <cell_data_string>');
    console.log('set-bg <x> <y> <id>');
    console.log('toggle-wrap');
    console.log('set-grid <code>');
    console.log('kick-user <id>');
    console.log('list-users');
    console.log('list-cursors');
    console.log('list-hovers');
    console.log('direct-send <packet>');
    console.log('exit');
    console.log('default-role');
    console.log('set-default-role <role>');
    console.log('set-user-role <userID> <role>');
    console.log('user-roles');
    console.log('ban <userID> - Bans the IP of the user and also kicks them');
  } else if (cmd == 'ip-ban' || cmd == "ban") {
    var user;
    const {clientIDs} = require('./index')
    for (let ws of webSockets()) {
      if (clientIDs[ws] == args[0]) {
        user = ws;
      }
    }
    if (user == undefined) {
      console.log(`Can't find user of ID ${args[0]}`);
    } else {
      bannedIps.push(ipMap[user] ?? "");
      kickWS(user);
    }
  } else {
      // TODO
      /*if (commands.containsKey(cmd)) {
          var uri = Uri.dataFromString(commands[cmd],mimeType: 'application/dart');
          await Isolate.spawnUri(uri, args, null);
      } else {*/
          console.log(`Unknown command ${cmd}`);
      //}
  }
}

function getRoleStr(role) {
  for (let r of UserRole.values) {
    if (r.toString() == ("UserRole." + role.toLowerCase())) {
      return r;
    }
  }
  return null;
}

module.exports = {
    setupCommandIso: setupCommandIso
}