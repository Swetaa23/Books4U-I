import requests 
from urllib.parse import quote

class Book:
    def __init__(self, book_info, score):
        self.title = book_info['volumeInfo']['title']
        self.author = book_info['volumeInfo']['authors']
        self.previewLink = book_info['volumeInfo']['previewLink']
        self.thumbnail = book_info['volumeInfo']['imageLinks']['thumbnail']
        self.score = score
    
    def __repr__(self):
        return "title: {}\nauthor: {}\nlink: {}\nscore: {}".format(self.title, self.author, self.previewLink, self.score)

def get_books(author="", title="", category=""):
    parameters = []
    if author:
        parameters.append("inauthor:{}".format(author))
    if title:
        parameters.append("intitle:{}".format(title))
    if category:
        parameters.append("subject:{}".format(category))
    url_params = '+'.join(parameters)
    
    book_items = []
    start_index = 0

    while True:
        URL = "https://www.googleapis.com/books/v1/volumes?q=" + url_params + "&maxResults=40&startIndex=" + str(start_index) 
        r = requests.get(url = URL).json()
        if "items" in r:
            book_items += r["items"]
        else:
            break
        start_index += 40

    return book_items

def get_book_info(book):
    selfLinkOriginal = book['selfLink']
    r = requests.get(url = selfLinkOriginal) 
    return r.json()

# returns matches in similarity
def similarity(original_categories, other_categories):
    matches = 0
    for y in other_categories:
        if y in original_categories:
            matches += 1
    return matches


title=quote("Origin")
author=quote("Dan Brown")

# get info on original book
books = get_books(author=author, title=title)
book = books[0]
authors = book['volumeInfo']['authors']
description = book['volumeInfo']['description']
broad_categories = book['volumeInfo']['categories']
book_info = get_book_info(book)
specific_categories = set(book_info['volumeInfo']['categories'])

# iterate over the books in all broad categories and collect their book info
# filter for books that have a matching category with the original book
recommended_books = []
for broad_category in broad_categories:
    books = get_books(category=broad_category)
    for book in books:
        other_book_info = get_book_info(book)
        if "volumeInfo" in other_book_info and "categories" in other_book_info["volumeInfo"]:
            other_book_categories = other_book_info['volumeInfo']['categories']
            score = similarity(specific_categories, other_book_categories)
            if score > 0:
                recommended_books.append(Book(other_book_info, score))
                print(recommended_books[-1])
    print("Finished category: {}".format(broad_category))

# sort books by score
recommended_books.sort(key=lambda b: b.score, reverse=True)

for rank, book in enumerate(recommended_books):
    print(rank+1)
    print(book)
    print('-----')
