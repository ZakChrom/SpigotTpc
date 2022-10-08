// import 'command.dart';
// import 'grid.dart';
// import 'roles.dart';
// import 'spigot/spigot.dart';
const {WebSocketServer} = require('ws');
const {ArgumentParser}  = require('argparse')
const fs                = require('fs')
const {
    makeGrid, 
    P4, 
    parseCellDataStr,
    wrap,
    insideGrid,
    grid
}                       = require('./grid')
const {
    getRole,
    UserRole,
    roles,
    defaultRole
}                       = require('./roles')
const {
    setupCommandIso
}                       = require('./command')

const ArgParser = new ArgumentParser({
  description: 'Argparse example'
});

var v = "Release Beta 3";

// API docs
/*

[Grid Management]
> place <x> <y> <id> <rot> <data> - Places cell
> bg <x> <y> <bg> - Sets background
> wrap - Toggles wrap mode
> setinit <code> - Sets initial state on the server
> toggle-invis <x> <y>

[Logic Management]
> edtype <type> - Is the editor type wanted by the server
> token <token JSON> - Server only, is how server knows of Client's ID and version.

[Hover Management]
> new-hover <uuid> <x> <y> <id> <rot> - Creates new hover
> set-hover <uuid> <x> <y> - Sets the new hover position
> drop-hover <uuid> - Removes the hover

[Cursor Management]
> set-cursor <uuid> <x> <y> <selection> <rotation> <texture> <data> - Sets cursor state
> remove-cursor <uuid> - Removes the cursor (client only)

*/

var whitelist = [];
var blacklist = [];

const ServerType = {
  sandbox: 0,
  level: 1,
}

var type = ServerType.sandbox;
var uuidBl = false;

var config;

function getConfig(a) {
  var args  = new ArgumentParser({});
  args.add_argument('--ip',             '--ip',             {default: 'local'             });
  args.add_argument('--port',           '--port',           {default: '8080'              });
  args.add_argument('--versions',       '--versions',       {default: ''                  });
  args.add_argument('--whitelist',      '--whitelist',      {default: ''                  });
  args.add_argument('--blacklist',      '--blacklist',      {default: ''                  });
  args.add_argument('--banned_packets', '--banned_packets', {default: ''                  });
  args.add_argument('--wait_time',      '--wait_time',      {default: '1000'              });
  args.add_argument('--kick-allowed',   '--kick-allowed',   {default: true, required: true});
  args.add_argument('--silent',         '--slient',         {required: false              });
  args.add_argument('--block_uuid',     '--block_uuid',     {required: false              });
  args.add_argument('--log',            '--log',            {required: false              });
  args.add_argument('--packetpass',     '--packetpass',     {required: true, default: true});
    
  args.add_argument('--type',           '--type',           {default: 'false'             });
  args.add_argument('--width',          '--width',          {default: 'false'             });
  args.add_argument('--height',         '--height',         {default: 'false'             });

  config = args.parse_args(a);
}

var ip;
var port;
var bannedPackets = []

// Main function
async function main(a) {
  getConfig(a);
  if (config.banned_packets != "") {
    bannedPackets.push(config.banned_packets.split(':'));
  }

  if (fs.existsSync('versions.txt')) {
    if (!config.silent) console.log('Reading allowed versions...');
    versions = vf.readAsLinesSync();
  }

  if (fs.existsSync('whitelist.txt')) {
    if (!config['silent']) console.log('Reading allowed IDs...');
    whitelist = whitelistFile.readAsLinesSync();
  }

  if (fs.existsSync('blacklist.txt')) {
    if (!config['silent']) console.log('Reading banned IDs...');
    blacklist = blacklistFile.readAsLinesSync();
  }

  var aV = config['versions'].split(':');
  if (aV.isNotEmpty && (config['versions'] != "")) versions.addAll(aV);

  fixVersions();

  var aWL = config['whitelist'].split(':');
  if ((aWL.isNotEmpty) && (config['whitelist'] != "")) versions.addAll(aWL);
  var aBL = config['blacklist'].split(':');
  if (aBL.isNotEmpty) {
    versions.addAll(aBL);
    if (blacklist.includes("@uuid")) {
      uuidBl = true;
    }
  }

  var serverType = config['type'];
  var width = config['width'];
  var height = config['height'];

  if (!config['silent']) {
    console.log("Welcome to The Puzzle Cell Server Handling System");
  }
  if (!config['silent']) console.log(`Server version: ${v}`);

  if (serverType == "false") {
    console.log("Please input server type (sandbox [1]/ level [2])");
    stdout.write("Server Type > ");
    serverType = stdin.readLineSync();
  }

  if (serverType != "sandbox" && serverType != "level" && serverType != "1" && serverType != "2") {
    console.log("Invalid server type");
    return;
  }

  if (serverType == "level" || serverType == "2") type = ServerType.level;

  if (serverType == "sandbox" || serverType == "1") {
    type = ServerType.sandbox;

    if (width == "false") {
      console.log("Please input grid width");
      stdout.write("Width > ");
      width = stdin.readLineSync();
    }

    if (height == "false") {
      console.log("Please input grid height");
      stdout.write("Height > ");
      height = stdin.readLineSync();
    }
    makeGrid(parseInt(width), parseInt(height));
  } else {
    console.log("Please input level code (P2, P3 or P4 only)");
    stdout.write("Level code > ");
    var code = stdin.readLineSync();

    loadStr(code);
  }

  var ip = await parseIP(config['ip']); // Parse IP

  var port = parseInt(config['port']); // Parse port

  if (arguments.isEmpty) {
    console.log("[ IP & Port Config ]");
    console.log(
      "Since there were no arguments passed in, the server has detected that you ran the executable by itself.",
    );
    console.log(
      "To avoid a bad experience, the server is now prompting you to choose the IP and port",
    );
    console.log("Options:");
    console.log(
      "local - This puts it on 127.0.0.1, which is the local host IP. If the ip is local, only your computer can connect to it!",
    );
    console.log(
      "zero - This puts it on 0.0.0.0, meaning any user connected to your WiFi or Ethernet will be able to join. Also, any person with your IP address can also connect, making this ideal for hosting a server for everyone to join",
    );
    stdout.write("IP > ");
    ip = await parseIP(stdin.readLineSync());

    console.log("Now, on to the port. The port must be a 4-digit number.");
    console.log(
      "If you don't input a valid number, it will use the default port 8080",
    );
    console.log(
      "Due to many other types of programs using 8080, since the port has to be different from all other apps using the network, we recommend using something other than the default. You can choose something random, like 5283",
    );

    stdout.write('Port > ');

    port = int.tryParse(stdin.readLineSync()) ?? 8080;
  }

  var server = await createServer(ip, port);

  if (config['silent']) {
    console.log('Server should be online');
  } else {
    if (arguments.isNotEmpty) {
      if (ip == "local" || ip == "127.0.0.1") {
        console.log(
          "You have ran this server on the localhost IP address constant (127.0.0.1 [localhost])",
        );
        console.log(
          "This means only you can connect to the server, as the localhost IP address only allows the computer it is hosted on to access it",
        );
      } else if (ip == 'zero' || ip == '0.0.0.0') {
        console.log("You have ran this server on IP 0.0.0.0");
        console.log(
          "This means only people connected through an ethernet wire can connect to it",
        );
      } else if (ip == 'self') {
        console.log(
          "WARNING: In 7 seconds it will say at what IP the server is hosted. You have no configured it to be local or zero, meaning it will display your actual IP",
        );
        await Future.delayed(Duration(seconds=7));
      }
    }
    console.log(
      `Server should be online, at ws://${server.address.address}:${server.port}/`,
    );
  }
    
  setupCommandIso() // Commands
  // Timer.periodic(Duration(seconds: 1), (timer) {
  //   stdout.write('> ');
  //   var msg = stdin.readLineSync()!.split(' ');

  //   processCommand(msg.first, msg.sublist(1));
  // });
}
var versions = [];
main()

function fixVersions() {
  for (var i = 0; i < versions.length; i++) {
    versions[i] = fixVersion(versions[i]);
  }

  while (versions.includes('')) {
    versions.remove('');
  }
}

function fixVersion(v) {
  while (v.endsWith(".0")) {
    v = v.substring(
      0,
      v.length - 2,
    ); // No more .0
  }

  return v;
}

var webSockets = [];
var gridCache;

class CellHover {
    constructor(x,y,id,rot) {
        this.x=x
        this.y=y
        this.id=id
        this.rot=rot
    }
}

var hovers = {};

var bannedPackets = [
  "edtype",
  "remove-cursor",
];

class ClientCursor {
    constructor(
        x,y,
        selection,texture,
        rotation, 
        data,
        author
    ) {
        this.x=x
        this.y=y
        this.selection=selection
        this.rotation=rotation
        this.texture=texture
        this.data=data
        this.author=author
    }
  
}

var cursors = {};

var clientIDs = {};
module.exports = {
    clientIDs: ()=>clientIDs,
    webSockets: ()=>webSockets
}
var clientIDList = [];

function removeWebsocket(ws) {
  if (!webSockets.includes(ws)) return;
  if (!config['silent']) console.log('User left');
  ws.sink.close();
  webSockets.remove(ws);

  versionMap.remove(ws);
  var cursorID = clientIDs[ws];
  if (cursorID == null) return;
  clientIDList.remove(cursorID);
  if (!config['silent']) console.log(`User ID: ${cursorID}`);
  cursors.remove(cursorID);
  for (let ws of webSockets) {
    ws.send(`remove-cursor ${cursorID}`);
  }
}

var versionMap = {};

var latestIP = "";
var ipMap = {};
var bannedIps = {};

function execPacket(data, ws) {
  if (!webSockets.includes(ws)) return;

  if (config['log']) {
    console.log(`Packet from ${clientIDs[ws] ?? "Unknown"} > ${data}`);
  }

  var args = data.split(' ');

  var typeBasedPackets = [];

  if (type == ServerType.level) {
    typeBasedPackets.addAll([
      "bg",
      "wrap",
    ]);
  }

  if (bannedPackets.includes(args.first) || typeBasedPackets.includes(args.first)) {
    console.log(`Kicking user for sending banned packet ${args.first}`);
    kickWS(ws);
    return;
  }
    
  switch (args[0]) {
    case "place":
      if (args.length != 6) {
        kickWS(ws);
        break;
      }
      if (getRole(ws) == UserRole.guest) {
        break;
      }
      var x = parseInt(args[1]);
      var y = parseInt(args[2]);
      if (wrap) {
        x = (x + grid().length) % grid().length;
        y = (y + grid()[0].length) % grid()[0].length;
      }

      if (!insideGrid(x, y)) break;
      var old = grid()[x][y].copy;
      grid()[x][y].id = args[3];
      grid()[x][y].rot = parseInt(args[4]);
      grid()[x][y].data = parseCellDataStr(args[5]);
      if (old != grid()[x][y]) {
        for (let ws of webSockets) {
          ws.send(data);
        }
        gridCache = null;
      }
      break;
    case "bg":
      if (args.length != 4) {
        kickWS(ws);
        break;
      }
      if (getRole(ws) == UserRole.guest) {
        break;
      }
      var x = parseInt(args[1]);
      var y = parseInt(args[2]);
      if (wrap) {
        x = (x + grid().length) % grid().length;
        y = (y + grid()[grid().length].length) % grid().first.length;
      }

      if (!insideGrid(x, y)) break;

      var old = grid()[x][y].bg;
      grid()[x][y].bg = args[3];
      if (old != args[3]) {
        for (let ws of webSockets) {
          ws.send(data);
        }
        gridCache = null;
      }
      break;
    case "wrap":
      if (args.length != 1) {
        kickWS(ws);
        break;
      }
      if (getRole(ws) == UserRole.guest) {
        break;
      }
      wrap = !wrap;
      for (var ows in webSockets) {
        ows.send(data);
      }
      gridCache = null;
      break;
    case "setinit":
      if (getRole(ws) == UserRole.guest) {
        //ws.send('drop-hover ${args[1]}');
        break;
      }
      if (gridCache != args[1]) {
        loadStr(args[1]);
        for (let ws of webSockets) {
          ws.send(data);
        }
        gridCache = args[1];
      }
      break;
    case "new-hover":
      if (args.length <= 6) {
        kickWS(ws);
        break;
      }
      if (getRole(ws) == UserRole.guest) {
        break;
      }
      hovers[args[1]] = CellHover(
        double.parse(args[2]),
        double.parse(args[3]),
        args[4],
        parseInt(
          args[5],
        ),
      );
      for (let ws of webSockets) {
        ws.send(data);
      }
      break;
    case "set-hover":
      if (args.length != 4) {
        kickWS(ws);
        break;
      }
      if (getRole(ws) == UserRole.guest) {
        break;
      }
      hovers[args[1]].x = double.parse(args[2]);
      hovers[args[1]].y = double.parse(args[3]);
      for (let ws of webSockets) {
        ws.send(data);
      }
      break;
    case "drop-hover":
      if (args.length != 2) {
        kickWS(ws);
        break;
      }
      if (getRole(ws) == UserRole.guest) {
        break;
      }
      hovers.remove(args[1]);
      for (let ws of webSockets) {
        ws.send(data);
      }
      break;
    case "set-cursor":
      if (args.length != 7 && args.length != 8 && args.length != 4) {
        kickWS(ws);
        break;
      }
      if (args[1] != clientIDs[ws]) break;

      if (args.length == 7) {
        args.push(":");
      }
      if (args.length == 4) {
        args.push("empty");
        args.push("0");
        args.push("cursor");
        args.push(":");
      }

      if (cursors[args[1]] == null) {
        cursors[args[1]] = new ClientCursor(
          parseFloat(args[2]),
          parseFloat(args[3]),
          args[4],
          parseInt(args[5]),
          args[6],
          parseCellDataStr(args[7]),
          ws,
        );
        if (!config['silent']) {
          console.log(`New cursor created. Client ID: ${args[1]}`);
        }
      } else {
        cursors[args[1]].x = parseFloat(args[2]);
        cursors[args[1]].y = parseFloat(args[3]);
      }
      for (let ws of webSockets) {
        ws.send(data);
      }
      break;
    case "token":
      var tokenJSON = JSON.parse(args.slice(1).join(" "));
      var v = tokenJSON["version"];
      // TODO
      /*if (v is String) {
        kickWS(ws);
        break;
      }*/
      var id = tokenJSON["clientID"];
      /*if (id is String) {
        kickWS(ws);
        break;
      }*/

      if (id.length > 500 || id.includes("\n")) {
        kickWS(ws);
        break;
      }
      if (clientIDList.hasOwnProperty(id)) {
        if (!config['silent']) {
          console.log("A user attempted to connect with duplicate ID");
        }
        kickWS(ws);
        break;
      }
      if (whitelist.isNotEmpty) {
        if (whitelist.includes(id)) {
          if (!config['silent']) {
            console.log(`User with whitelisted ID: ${id} has joined.`);
          }
        } else {
          console.log("User attempted to join with blocked ID");
          kickWS(ws);
          break;
        }
      }

      if (blacklist.isNotEmpty) {
        if (blacklist.includes(id)) {
          if (!config['silent']) {
            console.log("User attempted to join with a blocked ID");
          }
          kickWS(ws);
          break;
        }
      }

      if (config['block_uuid'] || uuidBl) {
        if (!config['silent']) {
          console.log('UUID blocking is enabled, validating ID...');
        }
        if (id.split('-').length == 5) {
          if (!config['silent']) console.log(`Blocked ID ${id}`);
          kickWS(ws);
          break;
        }
      }
      // TODO
      //roles()[id] = defaultRole;

      clientIDList.push(id);

      fixVersions();

      if (versions.includes(fixVersion(v))) {
        versionMap[ws] = fixVersion(v);
        clientIDs[ws] = id;
        if (!config['silent']) {
          console.log(`A new user has joined. ID: ${id}. Version: ${v}`);
        }
      } else if (versions.isEmpty) {
        versionMap[ws] = fixVersion(v);
        clientIDs[ws] = id;
        if (!config['silent']) {
          console.log(`A new user has joined. ID: ${id}. Version: ${v}`);
        }
      } else if (versions.isNotEmpty) {
        if (!config['silent']) {
          console.log('A user has joined with incompatible version');
        }
        kickWS(ws);
      } else {
        versionMap[ws] = fixVersion(v);
        clientIDs[ws] = id;
        if (!config['silent']) {
          console.log(`A new user has joined. ID: ${id}. Version: ${v}`);
        }
      }
      break;
    case "toggle-invis":
      if (args.length != 3) {
        kickWS(ws);
        break;
      }
      var x = parseInt(args[1]);
      var y = parseInt(args[2]);

      if (insideGrid(x, y)) {
        grid()[x][y].invisible = !grid()[x][y].invisible;
      }
      for (let ws of webSockets) {
        ws.send(data);
      }
      break;
    default:
      if (config['packetpass']) {
        if (!config['silent']) {
          console.log(
            `Randomly got invalid packet ${data}. Sending to other clients.`,
          );
        }
        for (let ws of webSockets) {
          ws.send(data);
        }
      }
      break;
  }
}

async function createServer(ip, port) {
  const wss = new WebSocketServer({ port: 8080 });
  wss.on('connection', (ws) => {
      webSockets.push(ws);
      if (latestIP != null) {
        // TODO
        //ipMap[ws] = sha256.convert(utf8.encode(latestIP)).toString();
        latestIP = null;
      }
      //console.log(ws)
      ws.on('message', (data) => {
          // TODO
          data = data.toString()
          //if (typeof(data) == 'string') {
            var d = data.split('\n');
            for (let dt of d) {
              execPacket(dt, ws);
            }
          //}
        },
        onDone=() => removeWebsocket(ws),
        onError=(e) => removeWebsocket(ws),
      );

      // Send grid
      gridCache ??= P4.encodeGrid(); // Speeeeeed
      ws.send(`grid ${gridCache}`); // Send to client

      if (type == ServerType.level) {
        ws.send(
          'edtype puzzle',
        ); // Send special editor type

        hovers.forEach(
          (uuid, hover) => {
            ws.send(
              `new-hover ${uuid} ${hover.x} ${hover.y} ${hover.id} ${hover.rot}`,
            );
          },
        ); // Send hovering cells

        cursors.forEach(
          (id, cursor) => {
            ws.send(`set-cursor ${id} ${cursor.x} ${cursor.y} ${cursor.selection} ${cursor.rotation} ${cursor.texture} ${cellDataStr(cursor.data)}`);
          },
        ); // Send cursors
      }

      fixVersions();
      if (versions.isNotEmpty) {
        Future.delayed(Duration(milliseconds=parseInt(config['wait_time']))).then(
          (v) => {
            if (!versions.includes(versionMap[ws])) {
              console.log("User kicked for no connection token sent");
              kickWS(ws); // Remove for invalid version
            } // Version check
          },
        );
      } // Version checking
    },
  );

  //var server = await sio.serve(serverThing(wss), ip, port); // Create server

  return wss; // Return server
}

async function parseIP(ip) {
  if (ip == 'local' || ip == 'localhost') {
    return '127.0.0.1';
  }

  if (ip == 'zero') {
    return '0.0.0.0';
  }

  if (ip == 'self') {
    return await Ipify.ipv4();
  }

  return ip;
}

function kickWS(ws) {
  var kickAllowed = config['kick-allowed'];

  if (kickAllowed) {
    removeWebsocket(ws);
    if (!config['silent']) console.log('A user has been kicked');
  } else {
    if (!config['silent']) console.log('A user wasnt kicked');
  }
}

function serverThing(wsHandler) {
  return (rq) => {
    var ip = rq.headers['X-Forwarded-For'];

    // IP would be null if this was from the host computer
    if (ip != null) {
      var ipHash = sha256.convert(utf8.encode(ip)).toString();

      if (bannedIps.includes(ipHash)) {
        return Response.forbidden("IP has been banned");
      }
    }

    latestIP = ip;

    if (rq.method != "GET") {
      return Response.ok("Server exists");
    } else {
      return wsHandler(rq);
    }
  };
}
