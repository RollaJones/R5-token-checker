
let support = 0, unsure = 0, noSupport = 0;
let thumbUp = 0, thumbDown = 0;

function vote(type) {
    if (type === 'support') {
        support++;
        document.getElementById('supportCount').textContent = support;
    } else if (type === 'unsure') {
        unsure++;
        document.getElementById('unsureCount').textContent = unsure;
    } else if (type === 'noSupport') {
        noSupport++;
        document.getElementById('noSupportCount').textContent = noSupport;
    }
}

function thumbVote(type) {
    if (type === 'up') {
        thumbUp++;
        document.getElementById('thumbUpCount').textContent = thumbUp;
    } else if (type === 'down') {
        thumbDown++;
        document.getElementById('thumbDownCount').textContent = thumbDown;
    }
}

function toggleContent(id) {
    var content = document.getElementById(id);
    if (content.style.display === "block") {
        content.style.display = "none";
    } else {
        content.style.display = "block";
    }
}
