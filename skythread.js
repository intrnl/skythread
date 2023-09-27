function init() {
  window.dateLocale = localStorage.getItem('locale') || undefined;


  document.querySelector('#search form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitSearch();
  });

  document.querySelector('#search input').addEventListener('mousedown', (e) => {
    e.target.classList.add('click');
  });

  document.querySelector('#search input').addEventListener('blur', (e) => {
    e.target.classList.remove('click');
  });

  window.api = new BlueskyAPI();

  parseQueryParams();
}

function parseQueryParams() {
  let params = new URLSearchParams(location.search);
  let query = params.get('q');
  let author = params.get('author');
  let post = params.get('post');

  if (query) {
    showLoader();
    loadThread(decodeURIComponent(query));
  } else if (author && post) {
    showLoader();
    loadThread(decodeURIComponent(author), decodeURIComponent(post));
  } else {
    showSearch();
  }
}

function buildParentLink(post) {
  let p = document.createElement('p');
  p.className = 'back';

  if (post.blocked) {
    let element = new PostComponent(post).buildElement();
    element.className = 'back';
    element.querySelector('p.blocked-header span').innerText = 'Parent post blocked';
    return element;
  } else if (post.missing) {
    p.innerHTML = `<i class="fa-solid fa-ban"></i> parent post has been deleted`;
  } else {
    let url = linkToPostThread(post);
    p.innerHTML = `<i class="fa-solid fa-reply"></i><a href="${url}">See parent post (@${post.author.handle})</a>`;
  }

  return p;
}

function showLoader() {
  document.getElementById('loader').style.display = 'block';
}

function hideLoader() {
  document.getElementById('loader').style.display = 'none';
}

function showSearch() {
  document.getElementById('search').style.visibility = 'visible';
}

function hideSearch() {
  document.getElementById('search').style.visibility = 'hidden';
}

function submitSearch() {
  let url = document.getElementById('search').querySelector('input[name=q]').value.trim();

  if (!url) { return }

  try {
    let [handle, postId] = BlueskyAPI.parsePostURL(url);

    let newURL = linkToPostById(handle, postId);
    location.assign(newURL);
  } catch (error) {
    console.log(error);
    alert(error);
  }
}

function loadThread(url, postId, nodeToUpdate) {
  let load = postId ? api.loadThreadById(url, postId) : api.loadThreadByURL(url);

  load.then(json => {
    let root = Post.parse(json.thread);
    window.root = root;

    if (root.parent && !nodeToUpdate) {
      let p = buildParentLink(root.parent);
      document.body.appendChild(p);
    }

    let list = new PostComponent(root).buildElement();
    hideLoader();

    if (nodeToUpdate) {
      nodeToUpdate.querySelector('.content').replaceWith(list.querySelector('.content'));
    } else {
      document.body.appendChild(list);      
    }
  }).catch(error => {
    hideLoader();
    console.log(error);
    alert(error);
  });
}
