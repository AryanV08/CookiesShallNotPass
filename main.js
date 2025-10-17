(() => {
    window.addEventListener("load", init);
  
    function init() {
      const box = document.getElementById("toggler-1");
  
      box.addEventListener("change", () => {
        if (box.checked) {
          alert("Checkbox is checked ✅");
        } else {
          alert("Checkbox is unchecked ❌");
        }
      });
    }
  })();