const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Calculate descriptive statistics
function calculateStatistics(data) {
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  
  if (n === 0) {
    return { error: 'No valid data provided' };
  }
  
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  
  // Variance and Standard Deviation
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  // Median
  const median = n % 2 === 0 
    ? (sorted[Math.floor(n/2) - 1] + sorted[Math.floor(n/2)]) / 2 
    : sorted[Math.floor(n/2)];
  
  // Mode
  const frequencyMap = {};
  sorted.forEach(val => {
    frequencyMap[val] = (frequencyMap[val] || 0) + 1;
  });
  const mode = parseFloat(
    Object.keys(frequencyMap).reduce((a, b) => 
      frequencyMap[a] > frequencyMap[b] ? a : b
    )
  );
  
  // Quartiles
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  // Range
  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max - min;
  
  // Skewness (Pearson's coefficient)
  const skewness = (3 * (mean - median)) / stdDev;
  
  // Coefficient of Variation
  const cv = (stdDev / mean) * 100;
  
  return {
    count: n,
    sum: parseFloat(sum.toFixed(4)),
    mean: parseFloat(mean.toFixed(4)),
    median: parseFloat(median.toFixed(4)),
    mode: parseFloat(mode.toFixed(4)),
    variance: parseFloat(variance.toFixed(4)),
    stdDev: parseFloat(stdDev.toFixed(4)),
    min: parseFloat(min.toFixed(4)),
    max: parseFloat(max.toFixed(4)),
    range: parseFloat(range.toFixed(4)),
    q1: parseFloat(q1.toFixed(4)),
    q3: parseFloat(q3.toFixed(4)),
    iqr: parseFloat(iqr.toFixed(4)),
    skewness: parseFloat(skewness.toFixed(4)),
    coefficientOfVariation: parseFloat(cv.toFixed(4))
  };
}

// Route: Calculate statistics from array of numbers
app.post('/api/calculate', (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data format. Expected array of numbers.' });
    }
    
    const numericData = data.filter(val => typeof val === 'number' && !isNaN(val));
    
    if (numericData.length === 0) {
      return res.status(400).json({ error: 'No valid numeric data provided.' });
    }
    
    const stats = calculateStatistics(numericData);
    res.json({ success: true, statistics: stats, dataPoints: numericData.length });
  } catch (error) {
    console.error('Error calculating statistics:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Route: Upload CSV and calculate statistics
app.post('/api/upload-csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const results = [];
  const filePath = path.join(__dirname, req.file.path);
  
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
      if (results.length === 0) {
        return res.status(400).json({ error: 'Empty CSV file' });
      }
      
      // Get column names
      const columns = Object.keys(results[0]);
      
      // Calculate statistics for each numeric column
      const columnStats = {};
      
      columns.forEach(column => {
        const columnData = results
          .map(row => parseFloat(row[column]))
          .filter(val => !isNaN(val));
        
        if (columnData.length > 0) {
          columnStats[column] = calculateStatistics(columnData);
        }
      });
      
      res.json({
        success: true,
        columns: columns,
        rowCount: results.length,
        statistics: columnStats,
        data: results
      });
    })
    .on('error', (error) => {
      console.error('Error parsing CSV:', error);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.status(500).json({ error: 'Error parsing CSV file', message: error.message });
    });
});

// Route: Get histogram data
app.post('/api/histogram', (req, res) => {
  try {
    const { data, bins = 10 } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    const numericData = data.filter(val => typeof val === 'number' && !isNaN(val));
    
    if (numericData.length === 0) {
      return res.status(400).json({ error: 'No valid numeric data' });
    }
    
    const sorted = [...numericData].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const binSize = (max - min) / bins;
    
    const histogram = Array(bins).fill(0).map((_, i) => ({
      binStart: min + i * binSize,
      binEnd: min + (i + 1) * binSize,
      count: 0,
      percentage: 0
    }));
    
    numericData.forEach(val => {
      const binIndex = Math.min(Math.floor((val - min) / binSize), bins - 1);
      histogram[binIndex].count++;
    });
    
    histogram.forEach(bin => {
      bin.percentage = parseFloat(((bin.count / numericData.length) * 100).toFixed(2));
    });
    
    res.json({ success: true, histogram });
  } catch (error) {
    console.error('Error creating histogram:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Route: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Statistics API is running' });
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});