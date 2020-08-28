let bookContainer = document.querySelector(".search");
let bookTitle = document.getElementById("title-box");
let bookAuthor = document.getElementById("author-box");

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
    this.author = book_info['volumeInfo']['authors'] || "not found";
    this.previewLink = book_info['volumeInfo']['previewLink'];
    this.score = score;

    if (book_info['volumeInfo']['imageLinks'] && book_info['volumeInfo']['imageLinks']['thumbnail']) {
      this.thumbnail = book_info['volumeInfo']['imageLinks']['thumbnail'].replace("http://", "https://");
    } else {
      this.thumbnail = "icons/logo.svg";
    }
  }

  toString() {
    return `title: ${this.title}\nauthor: ${this.author}\nlink: ${this.previewLink}\nscore: ${this.score}`;
  }
}

async function getBooks(author="", title="", category="", minResults=0, maxResults=50) {
  const parameters = [];
  if (author) {
    parameters.push(`inauthor:${encodeURIComponent(author)}`);
  }
  if (title) {
    parameters.push(`intitle:${encodeURIComponent(title)}`);
  }
  if (category) {
    parameters.push(`subject:${encodeURIComponent(category)}`);
  }
  const urlParams = parameters.join('+');

  let bookItems = await getBooksHelper(urlParams, maxResults);
  if (bookItems.length < minResults) {
    bookItems = getBooksHelper(encodeURIComponent(author+title+category), maxResults);
  }
  return bookItems;
}

async function getBooksHelper(urlParams, maxResults) {
  let bookItems = [];
  let startIndex = 0;
  while (true) {
    if (startIndex > maxResults) {
      break;
    }
    const URL = `https://www.googleapis.com/books/v1/volumes?q=${urlParams}&maxResults=40&startIndex=${startIndex}`;
    try {
      const response = await fetch_retry(URL);
      const r = await response.json();
      if ("items" in r) {
        bookItems = bookItems.concat(r["items"]);
      } else {
        break;
      }
      startIndex += 40
    } catch (err) {
      console.log("Too many queries - exiting early")
      break;
    }
  }
  return bookItems
}

async function getBookInfo(book) {
  const selfLinkOriginal = book['selfLink'];
  try {
    const r = await fetch_retry(selfLinkOriginal);
    return await r.json();
  } catch (err) {
    console.log("Failed to get book info - try again later");
    return {};
  }
}

// returns matches in similarity
function similarity(original_categories, other_categories){
  const weightings = [0.05, 0.95];
  // 1st score: matching broad category
  // 2nd score: matching specific categories
  const similarity_scores = [1, 0];

  // compute the 2nd score for matching specific categories using Jaccard Similarity
  let matches = 0
  for (const y of other_categories) {
    if (original_categories.has(y)) {
      matches += 1
    }
  }
  similarity_scores[1] = matches/(original_categories.size + other_categories.length - matches)

  let similarity_score = 0;
  for (let i = 0; i < similarity_scores.length; ++i) {
    similarity_score += similarity_scores[i]*weightings[i];
  }
  return similarity_score;
}



async function findBooks() {
  bookContainer.style.display = "flex";
  bookContainer.innerHTML = `<div class='prompt'><div class="loader"/></div>`;

  // get info on original books
  let books = await getBooks(bookAuthor.value, bookTitle.value);
  let broadCategories = [];
  let specificCategories = new Set();

  for (const book of books) {
    if ("volumeInfo" in book && "categories" in book["volumeInfo"]) {
      broadCategories = book['volumeInfo']['categories'];
      const bookInfo = await getBookInfo(book);
      if ("volumeInfo" in bookInfo) {
        specificCategories = new Set(bookInfo['volumeInfo']['categories']);
        break;
      }
    }
  }

  // iterate over the books in all broad categories and collect their book info
  // filter for books that have a matching category with the original book
  let recommendedBooks = []
  for (const broadCategory of broadCategories) {
    books = await getBooks(undefined, undefined, broadCategory, 10);
    for (const book of books) {
      if ("volumeInfo" in book && book["volumeInfo"]["language"] === "en") {
        const otherBookInfo = await getBookInfo(book);
        if ("volumeInfo" in otherBookInfo && "categories" in otherBookInfo["volumeInfo"]) {
          const otherBookCategories = otherBookInfo['volumeInfo']['categories'];
          const score = similarity(specificCategories, otherBookCategories);
          recommendedBooks.push(new Book(otherBookInfo, score));
        }
      }
    }
    console.log(`Finished category: ${broadCategory}`);
  }

  // sort books by score
  recommendedBooks.sort((a,b) => b.score - a.score);
  recommendedBooks = recommendedBooks.slice(0, 50);

  const bookDivs = [];
  for (let i = 0; i < recommendedBooks.length; ++i) {
    const recommendedBook = recommendedBooks[i];
    bookDivs.push(
        `<div class='book' style='background: linear-gradient(` +
        getRandomColor() +
        `, rgba(0, 0, 0, 0));'><a href='${recommendedBook.previewLink}' target='_blank'><img class='thumbnail' src='` +
        recommendedBook.thumbnail + `' alt='cover'></a>` +
        `<div class='book-info'><h3 class='book-title'><a href='${recommendedBook.previewLink}' target='_blank'>${recommendedBook.title}</a></h3><div class='book-authors'>${recommendedBook.author}</div>` +
        `<div class='info' style='background-color: ` + getRandomColor() + `;'>` + `Similarity: ${Number(recommendedBook.score).toFixed(2)}` +
        `</div></div></div>`
    );
  }

  bookContainer.innerHTML = bookDivs.join("");
}

const getRandomColor = () =>
  `#${Math.floor(Math.random() * 16777215).toString(16)}40`;

// apply dark theme
document.documentElement.setAttribute("data-theme", "dark");
