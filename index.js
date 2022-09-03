const express = require("express");
const fs = require("fs");
const natural = require("natural");
const { removeStopwords } = require("stopword");

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

//including the public folder
app.use(express.static("public"));

const PORT = process.env.PORT || 5000;

//Listening on port 3000
app.listen(PORT, () => {
  console.log("Server is running...");
});

//Routes
app.get("/", (req, res) => {
  //sending index.ejs file from views folder
  res.render("index.ejs");
});

app.get("/problem:id", (req, res) => {
  let titles = fs.readFileSync("./database/titles.json").toString();
  titles = JSON.parse(titles);

  let links = fs.readFileSync("./database/links.json").toString();
  links = JSON.parse(links);

  let id = req.params.id;

  let problem_text = fs
    .readFileSync("./problems/" + "problem" + id + ".txt")
    .toString();

  //deleting text upto first line
  problem_text = problem_text.substring(problem_text.indexOf("\n") + 1);

  res.render("problem.ejs", {
    problem_text: problem_text,
    ques_title: titles[id - 1],
    link: links[id - 1],
  });
});

app.get("/error", (req, res) => {
  res.render("error.ejs");
});

app.get("/search", (req, res) => {
  /* Required functions for array initializations*/
  function create1dArray(length, value) {
    let array = [];
    for (let i = 0; i < length; i++) {
      array.push(value);
    }

    return array;
  }

  function createArray(length, breadth, value) {
    let array = [];
    for (let i = 0; i < length; i++) {
      array.push(create1dArray(breadth, value));
    }
    return array;
  }

  /* ---------------------------------- */

  /* Reading and parsing Datas */

  let tfidf = fs.readFileSync("./database/tf-idf.json").toString();
  tfidf = JSON.parse(tfidf);

  let idf = fs.readFileSync("./database/idf.json").toString();
  idf = JSON.parse(idf);

  let keywords = fs.readFileSync("./database/keywords.json").toString();
  keywords = JSON.parse(keywords);

  let titles = fs.readFileSync("./database/titles.json").toString();
  titles = JSON.parse(titles);

  let tags = fs.readFileSync("./database/tags.json").toString();
  tags = JSON.parse(tags);

  let links = fs.readFileSync("./database/links.json").toString();
  links = JSON.parse(links);

  /* ---------------------------------- */

  let final = createArray(1781, 7730, 0);

  for (let i = 0; i < tfidf.length; i++) {
    let fileNum = tfidf[i][0];
    let wordNum = tfidf[i][1];
    let tfidfScore = tfidf[i][2];

    final[fileNum - 1][wordNum] = tfidfScore;
  }

  //console.log(final);

  let query = req.query.query;
  var tokenizer = new natural.WordTokenizer();

  let tokens = tokenizer.tokenize(query.toLowerCase());

  let filtered = removeStopwords(tokens);

  let tfidf_query = create1dArray(7730, 0);

  for (let i = 0; i < filtered.length; i++) {
    let word = filtered[i];
    let wordNum = keywords.indexOf(word);
    let idfScore = idf[wordNum];
    tfidf_query[wordNum] = idfScore;
  }

  for (let i = 0; i < filtered.length; i++) {
    let totalWords = filtered.length;
    let word = filtered[i];
    let wordFreq = filtered.filter(function (item) {
      return item === word;
    }).length;

    let wordNum = keywords.indexOf(word);

    let tfidfScore = wordFreq / totalWords;

    tfidf_query[wordNum] *= tfidfScore;
  }

  let cosineSimilarity = function (a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += Math.pow(a[i], 2);
      normB += Math.pow(b[i], 2);
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  let top5 = [];

  for (let i = 0; i < final.length; i++) {
    let score = cosineSimilarity(tfidf_query, final[i]);
    top5.push([i + 1, score]);
  }

  top5.sort(function (a, b) {
    return b[1] - a[1];
  });

  for (let i = 0; i < 51; i++) {
    if (top5[i][1] === top5[i + 1][1]) {
      top5.splice(i + 1, 1);
    }
  }

  let top5_final = top5.slice(0, 5);

  //if the score is NaN, then the query is not found in the database return error page
  if (isNaN(top5_final[0][1])) {
    res.redirect("/error");
  }

  let final_titles = [];
  let final_tags = [];
  let final_links = [];
  let question_id = [];

  for (let i = 0; i < top5_final.length; i++) {
    final_titles.push(titles[top5_final[i][0] - 1]);

    final_tags.push(tags[top5_final[i][0] - 1]);
    final_links.push(links[top5_final[i][0] - 1]);
    question_id.push(top5_final[i][0]);
  }

  //adding an space before every , in final_tags
  for (let i = 0; i < final_tags.length; i++) {
    final_tags[i] = final_tags[i].replace(/,/g, ", ");
  }

  let sent_query = req.query.query;

  res.render("result.ejs", {
    value: sent_query,
    titles: final_titles,
    snippet: final_tags,
    links: final_links,
    id: question_id,
  });
});
