document.getElementById('btn-rundown').addEventListener('click', () => {
  browser.windows.create({
    url: "/rundown/rundown.html",
    type: "popup",
    width: 600,
    height: 800
  });
  window.close(); // Close the menu popup
});
