console.log("Storage Manager Sample Application");

function calculateTotalSpace(items) {
  return items.reduce((sum, item) => sum + (item.size || 0), 0);
}

module.exports = { calculateTotalSpace };

