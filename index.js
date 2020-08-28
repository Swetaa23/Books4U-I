let bookContainer = document.querySelector(".search");
let bookTitle = document.getElementById("title-box");
let bookAuthor = document.getElementById("author-box");

bookTitle.value = "origin";
bookAuthor.value = "dan brown";

const delay = interval => new Promise(resolve => setTimeout(resolve, interval));

async function fetch_retry(url, n=5, currTry=1) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      return response;
    } else {
      throw Error(response.statusText);
    }
  } catch(err) {
    if (currTry === n) throw err;
    await delay(Math.pow(2, currTry)*1000);
    return await fetch_retry(url, n, currTry+1);
  }
}

class Book {
  constructor(book_info, score) {
    this.title = book_info['volumeInfo']['title'];
    this.author = book_info['volumeInfo']['authors'];
    this.previewLink = book_info['volumeInfo']['previewLink'];
    this.score = score;

    if (book_info['volumeInfo']['imageLinks']['thumbnail']) {
      this.thumbnail = book_info['volumeInfo']['imageLinks']['thumbnail'].replace("http://", "https://");
    } else {
      this.thumbnail = "icons/logo.svg";
    }
  }

  toString() {
    return `title: ${this.title}\nauthor: ${this.author}\nlink: ${this.previewLink}\nscore: ${this.score}`;
  }
}

async function getBooks(author="", title="", category="") {
  const parameters = [];
  if (author) {
    parameters.push(`inauthor:${author}`);
  }
  if (title) {
    parameters.push(`intitle:${title}`);
  }
  if (category) {
    parameters.push(`subject:${category}`);
  }
  const urlParams = parameters.join('+');

  let bookItems = [];
  let startIndex = 0;
  while (true) {
    const URL = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(urlParams)}&maxResults=40&startIndex=${startIndex}`;
    const response = await fetch_retry(URL);
    const r = await response.json();
    if ("items" in r) {
      bookItems = bookItems.concat(r["items"]);
    } else {
      break;
    }
    startIndex += 40
  }

  return bookItems
}

async function getBookInfo(book) {
  const selfLinkOriginal = book['selfLink'];
  const r = await fetch_retry(selfLinkOriginal);
  return await r.json();
}

// returns matches in similarity
function similarity(original_categories, other_categories){
  let matches = 0
  for (const y of other_categories) {
    if (original_categories.has(y)) {
      matches += 1
    }
  }
  return matches
}

async function findBooks() {
  bookContainer.style.display = "flex";
  bookContainer.innerHTML = `<div class='prompt'><div class="loader"></div></div>`;

  // get info on original book
  let books = await getBooks(bookAuthor.value, bookTitle.value);
  const book = books[0];
  const authors = book['volumeInfo']['authors'];
  const description = book['volumeInfo']['description'];
  const broadCategories = book['volumeInfo']['categories'];
  const bookInfo = await getBookInfo(book);
  const specificCategories = new Set(bookInfo['volumeInfo']['categories']);

  // iterate over the books in all broad categories and collect their book info
  // filter for books that have a matching category with the original book
  const recommendedBooks = []
  for (const broadCategory of broadCategories) {
    books = await getBooks(undefined, undefined, broadCategory);
    for (const book of books) {
      if ("volumeInfo" in book && book["volumeInfo"]["language"] === "en") {
        const otherBookInfo = await getBookInfo(book);
        if ("volumeInfo" in otherBookInfo && "categories" in otherBookInfo["volumeInfo"]) {
          const otherBookCategories = otherBookInfo['volumeInfo']['categories'];
          const score = similarity(specificCategories, otherBookCategories);
          if (score > 0) {
            recommendedBooks.push(new Book(otherBookInfo, score));
          }
        }
      }
    }
    console.log(`Finished category: ${broadCategory}`);
  }

  // sort books by score
  recommendedBooks.sort((a,b) => b.score - a.score);

  const bookDivs = [];
  for (let i = 0; i < recommendedBooks.length; ++i) {
    const recommendedBook = recommendedBooks[i];
    bookDivs.push(
        `<div class='book' style='background: linear-gradient(` +
        getRandomColor() +
        `, rgba(0, 0, 0, 0));'><a href='${recommendedBook.previewLink}' target='_blank'><img class='thumbnail' src='` +
        recommendedBook.thumbnail + `' alt='cover'></a>` +
        `<div class='book-info'><h3 class='book-title'><a href='${recommendedBook.previewLink}' target='_blank'>${recommendedBook.title}</a></h3><div class='book-authors'>${recommendedBook.author}</div>` +
        `<div class='info' style='background-color: ` + getRandomColor() + `;'>` + `Similarity: ${recommendedBook.score}` +
        `</div></div></div>`
    );
  }

  bookContainer.innerHTML = bookDivs.join("");
}

const getRandomColor = () =>
  `#${Math.floor(Math.random() * 16777215).toString(16)}40`;

// dark
document.documentElement.setAttribute("data-theme", "dark");
// light
// document.documentElement.setAttribute("data-theme", "light");
// document
//   .querySelector("meta[name=theme-color]")
//   .setAttribute("content", "#ffffff");
