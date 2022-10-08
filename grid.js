const BaseXCodec = require('base-x')
const zlib = require('node:zlib');
const utf8 = require('utf8');

class Cell {
    constructor(id,rot,bg,lifespan=0,data,tags,invisible) {
        this.id=id
        this.rot=rot
        this.bg=bg
        this.lifespan=lifespan
        this.data=data
        this.tags=tags
        this.invisible=invisible
    }
    
    get copy() {
        return new Cell(this.id, this.rot, this.bg, this.lifespan, this.data, this.tags, this.invisible);
    }

    get hashCode() {
        return (rot * 4 + bg.hashCode + 20000 + rot.hashCode + 10000)
    }

    operator(other) {
        if (typeof(other) == Cell)
          return (id==other.id&&rot==other.rot&&bg==other.bg&&invisible==other.invisible&&setsEqual(tags,other.tags)&&mapsEqual(data, other.data));
        else
          return false;
    }
}

function cellDataStr(m) {
  var strs = [];

  m.forEach((key, value) => {
    strs.add(`${key}=${value}`);
  });

  return strs.join(":");
}

function parseCellDataStr(str) {
  if (parseInt(str) != null) {
    return {"heat": parseInt(str)};
  }
  var pairs = str.split(':');
  var m = {};

  for (var pair in pairs) {
    var segs = pair.split('=');
    var key = segs[0];

    if (num.tryParse(segs[1]) != null) {
      m[key] = num.parse(segs[1]);
    } else if (segs[1] == "true" || segs[1] == "false") {
      m[key] = (segs[1] == "true");
    } else {
      m[key] = segs[1];
    }
  }

  return m;
}

grid = [];

var wrap = false;

function loopGrid(callback) {
  for (var x = 0; x < grid.length; x++) {
    for (var y = 0; y < grid[x].length; y++) {
      callback(grid[x][y], x, y);
    }
  }
}

function loopGridPos(callback) {
  for (var x = 0; x < grid.length; x++) {
    for (var y = 0; y < grid[x].length; y++) {
      callback(grid[x][y], x, y);
    }
  }
}

function insideGrid(x, y) {
  return (x >= 0 && y >= 0 && x < grid.length && y < grid[x].length);
}

function placeChar(place) {
  if (place == "place") return "+";
  if (place == "red_place") return "R+";
  if (place == "blue_place") return "B+";
  if (place == "yellow_place") return "Y+";
  if (place == "rotatable") return "RT";
  return "";
}

function decodePlaceChar(char) {
  if (char == "+") return "place";
  if (char == "R+") return "red_place";
  if (char == "B+") return "blue_place";
  if (char == "Y+") return "yellow_place";
  if (char == "RT") return "rotatable";

  return "empty";
}

function encodeNum(n, valueString) {
  var cellNum = n;
  var cellBase = 0;

  while (cellNum >= Math.pow(valueString.length, cellBase)) {
    //print('$cellBase');
    cellBase++;
  }

  if (cellNum == 0) {
    return valueString[0];
  } else {
    var cellString = '';
    for (var i = 0; i < cellBase; i++) {
      var iN = Math.min(Math.floor(n / Math.pow(valueString.length, cellBase - 1 - i)), valueString.length - 1);
      cellString += valueString[iN];
      n -= iN * Math.pow(valueString.length, cellBase - 1 - i)
    }
    return cellString;
  }
}

function makeGrid(width, height) {
  grid = [];
  for (var x = 0; x < width; x++) {
    grid.push([]);
    for (var y = 0; y < height; y++) {
      grid[grid.length-1].push(new Cell("empty", 0, "empty", 0, {}, {}, false));
    }
  }
}

function decodeNum(n, valueString) {
  var numb = 0;
  for (var i = 0; i < n.length; i++) {
    var char = n[i];
    numb += valueString.indexOf(char) * pow(valueString.length, n.length - 1 - i).toInt();
  }
  return numb;
}

function loadStr(str) {
  if (str.startsWith('P2;')) return P2.decodeGrid(str); // P2 importing
  if (str.startsWith('P3;')) return P3.decodeString(str); // P3 importing
  if (str.startsWith('P4;')) return P4.decodeString(str); // P4 importing
}

class P2 {
  static valueString = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM[]{}()-_+=<>./?:'";

  static encodeCell(cell, cellTable) {
    return encodeNum(
      cellTable.toList().indexOf(cell.id) * 4 + cell.rot,
      valueString,
    );
  }

  static decodeCell(cell, cellTable) {
    var n = decodeNum(cell, valueString);
    var c = Cell(cellTable[Math.floor(n / 4)], n % 4, "empty", 0, {}, {}, false);

    return c;
  }

  static sig = "P2;";

  static encodeGrid() {
    var str = sig;
    str += ";;"; // title and description
    str += (encodeNum(grid.length, valueString) + ';');
    str += (encodeNum(grid.first.length, valueString) + ';');

    var cellTable = {};

    loopGrid(
      (cell, x, y) => {
        cellTable.add(cell.id);
      },
    );

    str += `${cellTable.join(',')};`;

    var cells = [];

    loopGrid(
      (cell, x, y) => {
        cells.add(`${this.encodeCell(cell, cellTable)}|${placeChar(cell.bg)}`);
      },
    );

    var cellStr = base64.encode(zlib.encode(utf8.encode(cells.join(','))));

    str += (cellStr + ';');

    var props = [];

    if (wrap) props.add("WRAP");

    str += `${props.join(',')};`;

    return str;
  }

  static decodeGrid(str) {
    var segs = str.split(';');
    makeGrid(decodeNum(segs[3], valueString), decodeNum(segs[4], valueString));

    var cellTable = segs[5].split(',');

    var cellData = utf8.decode(zlib.decode(base64.decode(segs[6])));

    var cells = cellData.split(',');

    var i = 0;
    loopGridPos(
      (cell, x, y) => {
        var cell = cells[i];
        grid[x][y] = decodeCell(cell.split('|').first, cellTable);
        var placeChar = cell.split('|').length == 1 ? '' : cell.split('|')[1];
        grid[x][y].bg = decodePlaceChar(placeChar);
        i++;
      },
    );

    if (segs.length >= 7) {
      // Special border mode
      var props = segs[7].split(',');
      wrap = props.contains('WRAP');
    }
  }
}

class P3 {
  static valueString = String.raw`0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!$%&+-.=?^{}`;

  static signature = "P3;";

  static encodeData(data) {
    var dataParts = [];
    data.forEach(
      (key, value) => {
        dataParts.add(`${key}=${value}`);
      },
    );
    return dataParts.join('.');
  }

  static encodeCell(x, y) {
    var c = grid[x][y];
    var bg = c.bg;

    var tagsStr = c.tags.join('.');

    var dataStr = encodeData(c.data);

    return `${c.id}:${x}:${y}:${c.rot}:${dataStr}:${tagsStr}:${bg}:${c.lifespan}`;
  }

  // P3 Compex Validation System
  static validate(x, y) {
    var c = grid[x][y];
    var bg = c.bg;

    return (c.id != "empty" || bg != "empty");
  }

  static encodeGrid({title = "", description = ""}) {
    var str = signature;
    str += `${title};${description};`; // Title and description
    str += `${encodeNum(grid.length, valueString)};`;
    str += `${encodeNum(grid.first.length, valueString)};`;

    var cellDataList = [];

    loopGrid(
      (cell, x, y) => {
        if (validate(x, y)) {
          cellDataList.add(this.encodeCell(x, y));
          //print(cellDataList.last);
        }
      },
    );

    var cellDataStr = base64.encode(
      zlib.encode(
        utf8.encode(
          cellDataList.join(','),
        ),
      ),
    );

    str += `${cellDataStr};`;

    var props = [];

    if (wrap) props.add("W");

    str += `${props.join('')};`;

    return str;
  }

  static getData(str) {
    if (str == "") return {};
    var segs = str.split('.');
    var data = {};
    if (segs.isEmpty) return data;
    for (var part in segs) {
      var p = part.split('=');

      var v = p[1];

      if (v == "true" || v == "false") v = (v == "true");
      if (int.tryParse(v) != null) v = int.parse(v);

      data[p[0]] = v;
    }
    return data;
  }

  static decodeCell(str) {
    var segs = str.split(':');

    if (segs.length < 8) segs.add("0");

    return new P3Cell(
      segs[0],
      int.parse(segs[1]),
      int.parse(segs[2]),
      int.parse(segs[3]),
      getData(segs[4]),
      segs[5].split('.').toSet(),
      segs[6],
      int.parse(segs[7]),
    );
  }

  static decodeString(str) {
    var segs = str.split(';');
    makeGrid(
      decodeNum(segs[3], valueString),
      decodeNum(segs[4], valueString),
    );

    var cellDataStr = segs[5] == "eJwDAAAAAAE=" ? "" : utf8.decode(zlib.decode(base64.decode(segs[5])));

    if (cellDataStr != "") {
      var cellDataList = cellDataStr.split(',');

      for (var cellData in cellDataList) {
        decodeCell(cellData).place();
      }
    }

    var props = segs[6].split('');
    if (props.contains("W")) wrap = true;
  }
}

class P3Cell {
    constructor(x,y,rot,id,bg,data,tags,lifespan) {
        this.id=id
        this.x=x
        this.y=y
        this.rot=rot
        this.data=data
        this.tags=tags
        this.bg=bg
        this.lifespan=lifespawn
    }
  

    place() {
        grid[x][y] = Cell(this.id, this.rot, this.bg, this.lifespan, this.data, this.tags, false);
    }
}

function fancySplit(thing, sep) {
  var chars = thing.split("");

  var depth = 0;

  var things = [""];

  for (var c in chars) {
    if (c == "(") {
      depth++;
    } else if (c == ")") {
      depth--;
    }
    if (depth == 0 && (c == sep || sep == "")) {
      if (sep == "") {
        things.last += c;
      }
      things.add("");
    } else {
      things.last += c;
    }
  }

  return things;
}

function stringContainsAtRoot(thing, char) {
  var chars = thing.split("");
  var depth = 0;

  for (var c in chars) {
    if (c == "(") {
      depth++;
    } else if (c == ")") {
      depth--;
    }
    if (depth == 0 && (c == char || char == "")) {
      return true;
    }
  }

  return false;
}

class P4 {
  static valueString = String.raw`0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!$%&+-.=?^{}`;

  static base = String.raw`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~/?:@&=+$,#()[]{}%'|^`;

  static baseEncoder = BaseXCodec(this.base);

  static header = "P4;";

  static encodeCell(x, y) {
    var c = grid[x][y];
    var bg = c.bg;

    var m = {
      "id": c.id,
      "rot": c.rot,
      "data": c.data,
      "tags": c.tags,
      "bg": bg,
      "lifespan": c.lifespan,
      "invisible": c.invisible,
    };

    return this.encodeValue(m);
  }

  static setCell(str, x, y) {
    var m = decodeValue(str);

    var c = Cell("", 0, "", 0, {}, {}, false);
    c.rot = m['rot'];
    if (m['data'] == {}) c.data = m['data']; // If it was empty, it would default to list lmao
    c.tags = m['tags'];
    c.id = m['id'];
    c.lifespan = m['lifespan'];
    c.invisible = m['invisible'] ?? false;
    var bg = m['bg'];

    c.bg = bg;
    grid[x][y] = c;
  }

  static encodeGrid(title="", description="") {
    var str = this.header + `${title};${description};`; // Header, title and description

    str += `${encodeNum(grid.length, this.valueString)};`;
    str += `${encodeNum(grid[0].length, this.valueString)};`;

    var cellDataList = [];

    loopGrid(
      (cell, x, y) => {
        var cstr = this.encodeCell(x, y);
        if (cellDataList.isNotEmpty) {
          var m = decodeValue(cellDataList.last);
          var c = m['count'];

          if (encodeValue(m['cell']) == cstr) {
            m['count'] = c + 1;
            cellDataList.last = encodeValue(m);
            return;
          }
        }
        cellDataList.push(this.encodeValue({"cell": cstr, "count": 1}));
      },
    );

    zlib.deflate(utf8.encode(cellDataList.join('')), undefined, (err,buffer) => {
        var cellDataStr = this.baseEncoder.encode(Uint8Array.from(buffer.toString('base64')))
    })
      
    // var cellDataStr = this.baseEncoder.encode(
    //   Uint8Array.fromList(zlib.deflate(
    //     utf8.encode(
    //       cellDataList.join(''),
    //     ),
    //   )),
    // );

    str += `${cellDataStr};`;

    var props = {};

    if (wrap) props['W'] = true;

    str += `${this.encodeValue(props)};`;

    return str;
  }

  static decodeString(str) {
    str.replaceAll('\n', '');
    var segs = str.split(';');

    var width = decodeNum(segs[3], valueString);
    var height = decodeNum(segs[4], valueString);
    makeGrid(width, height);

    var rawCellDataList = fancySplit(utf8.decode(zlib.decode(baseEncoder.decode(segs[5])).toList()), '');

    while (rawCellDataList.first == "") {
      rawCellDataList.removeAt(0);
    }
    while (rawCellDataList.last == "") {
      rawCellDataList.removeLast();
    }

    var cellDataList = [];

    for (var cellData in rawCellDataList) {
      var m = decodeValue(cellData);

      var c = m['count'] ?? 1;

      for (var i = 0; i < c; i++) {
        cellDataList.add(encodeValue(m['cell']));
      }
    }

    var i = 0;

    loopGrid(
      (cell, x, y) => {
        if (cellDataList.length > i) {
          setCell(cellDataList[i], x, y);
        }
        i++;
      },
    );

    var props = decodeValue(segs[6]);
    if (props['W'] != null) {
      if (props['W'] != wrap) {
        wrap = !wrap;
        for (var ws in webSockets) {
          ws.sink.add('wrap');
        }
      }
    }
  }
  //TODO
  static encodeValue(value) {
    /*if (value is Set) {
      value = value.toList();
    }
    if (value is List) {
        return '(' + value.map<String>((e) => encodeValue(e)).join(":") + ')';
    } else if (value is Map) {
      var keys = value.isEmpty ? ["="] : [];

      value.forEach((key, value) => {
        keys.add(`${key}=${encodeValue(value)}`);
      });
      return `(${keys.join(':')})`;
    }*/

    return value.toString();
  }

  static decodeValue(str) {
    if (str == '{}') return {};
    if (str == '()') return {};
    if (int.tryParse(str) != null) {
      return int.parse(str);
    } else if (double.tryParse(str) != null) {
      return double.parse(str);
    } else if (str == "true" || str == "false") {
      return str == "true";
    } else if (str.startsWith('(') && str.endsWith(')')) {
      var s = str.substring(1, str.length - 1);

      if (stringContainsAtRoot(s, '=')) {
        // It is a map, decode it as a map
        var map ={};

        var parts = fancySplit(s, ':');

        for (var part in parts) {
          var kv = fancySplit(part, '=');
          var k = kv[0];
          var v = decodeValue(kv[1]);

          map[k] = v;
        }
        return map;
      } else {
        // It is a list, decode it as a list
        return fancySplit(s, ':').map<dynamic>((e) => decodeValue(e)).toSet();
      }
    }

    return str;
  }
}

module.exports = {
    makeGrid: makeGrid,
    P4: P4,
    P3: P3,
    parseCellDataStr: parseCellDataStr,
    wrap: ()=>wrap,
    insideGrid: insideGrid,
    grid: ()=>grid
}