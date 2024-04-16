//
//  Created by Amsyari on 15/05/24.
//  amsyary.skenza313@gmail.com
//
class StreamRoom {
  constructor(streamId, initialViewerCount) {
    this.streamId = streamId;
    this.viewers = new Set();
    this.initialViewerCount = initialViewerCount;
  }

  addViewer(client) {
    this.viewers.add(client);
  }

  removeViewer(client) {
    this.viewers.delete(client);
  }

  getViewerCount() {
    return this.viewers.size;
  }
}

module.exports = StreamRoom;
