(() => {
  window.addEventListener("load", init);

  async function init() {
    const box = document.getElementById("toggler-1");
    box.addEventListener("change", async () => {
      if (box.checked) {
        await showCookies();
      } else {
        document.getElementById("cookietable").innerHTML = "";
        document.getElementById("cookietable").classList.remove("show");

       
      }
    });
  }

  async function showCookies() {
    const cookietable = document.getElementById("cookietable");
    document.getElementById("cookietable").classList.add("show");

    

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;

    if (!/^https?:\/\//i.test(url)) {
      cookietable.innerHTML = "<p>Cookies not accessible on this page.</p>";
      
      return;
    }

    const cookies = await chrome.cookies.getAll({ url });

   

    let p = document.createElement("p")
    p.textContent = "we have found  " + cookies.length + " cookies! "



    cookietable.appendChild(p);
    
  }
})();
