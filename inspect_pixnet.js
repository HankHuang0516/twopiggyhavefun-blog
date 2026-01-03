const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://lolwarden.pixnet.net/blog/post/225077269';

async function inspect() {
  try {
    const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    const $ = cheerio.load(data);

    console.log('--- Inspection Results ---');
    
    // Title
    const title = $('.title h2 a').text().trim() || $('.article-title').text().trim() || $('h2').first().text().trim();
    console.log('Title:', title);

    // Date
    const date = $('.publish-date').text().trim() || $('.article-date').text().trim() || $('.date').text().trim();
    console.log('Date:', date);

    // Content
    const content = $('#article-content-inner').html() || $('.article-content').html() || $('.article-body').html();
    console.log('Content Found:', !!content);
    if (content) {
        console.log('Content Length:', content.length);
        console.log('Content Preview:', content.substring(0, 200));
    }
    
    // Images
    const images = [];
    $('#article-content-inner img').each((i, el) => {
        images.push($(el).attr('src'));
    });
    console.log('Images Found:', images.length);
    console.log('First Image:', images[0]);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

inspect();
