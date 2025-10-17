(() => {
  window.addEventListener("load", init);

  async function init() {
    let cookietable = document.getElementById("cookietable");

    let p = document.createElement("p")
    p.textContent = "welcome! "

    cookietable.appendChild(p);
    cookietable.classList.add("show")



    
    const box = document.getElementById("toggler-1");

    box.addEventListener("change", async () => {
      if (box.checked) {
       
        await showCookies();
        
      } else {

        cookietable.innerText="section closed"
       
       
      }
    });
  }

  async function showCookies() {
    
    document.getElementById("cookietable").classList.add("show");

    

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;

    if (!/^https?:\/\//i.test(url)) {
      cookietable.innerHTML = "<p>Cookies not accessible on this page.</p>";
      
      return;
    }

    const cookies = await chrome.cookies.getAll({ url });


    cookietable.innerText =  "we have found  " + cookies.length + " cookies! ";

  }
})();
