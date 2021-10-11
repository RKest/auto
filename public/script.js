const form = document.querySelector("form");

form.addEventListener("submit", async e => {
    e.preventDefault();
    const email = form.elements.email.value;
    const passwd = form.elements.passwd.value;
    const date = form.elements.date.value;

    fetch("/", 
    { 
        method: "POST" ,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email,
            passwd,
            date
        })
    })
    .then(res => {
        if(res.ok){
            window.open(res.body);
        } else {
            alert(res.body);
        }
    });
});