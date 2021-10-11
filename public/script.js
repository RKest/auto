const form = document.getElementById("main-form");

form.addEventListener("submit", async e => {
    e.preventDefault();
    const email = form.elements.email.value;
    const passwd = form.elements.passwd.value;
    const date = form.elements.date.value;

    const data = {
        email, passwd, date
    }
    fetch("/", 
    { 
        method: "POST" ,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(async res => {
        const text = await res.text();
        console.log(text);
        if(res.ok)
            window.location.replace(text);
        else
            alert(text);
    });
});