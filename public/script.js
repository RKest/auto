const form = document.getElementById("main-form");
const progressBar = document.getElementById("prog");

form.addEventListener("submit", async e => {
    e.preventDefault();
    progressBar.style.visibility = "visible";
    const email = form.elements.email.value;
    const passwd = form.elements.passwd.value;
    const date = form.elements.date.value;

    const data = {
        email, passwd, date
    }

    const progressIntervalId = setInterval(updateProgress, 2000);

    fetch("/", 
    { 
        method: "POST",
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
    })
    .finally(() => {
        clearInterval(progressIntervalId);
    });
});

const updateProgress = async () => {
    fetch("/prog", 
    {
        method: "GET"
    }).then(async res => {
        const text = await res.text();
        progressBar.value = text * 100;
    });
}