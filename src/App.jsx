import React, { useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement);

function App() {
  const [numbers, setNumbers] = useState("");
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    const numArray = numbers.split(",").map((n) => parseFloat(n));
    const res = await axios.post("http://localhost:5000/api/stats", {
      numbers: numArray,
    });
    setResult(res.data);
  };

  return (
    <div style={{ textAlign: "center", padding: "20px", fontFamily: "Arial" }}>
      <h1>📊 Statistical Analysis & Probability Tools</h1>

      <input
        type="text"
        placeholder="Enter numbers (comma separated)"
        value={numbers}
        onChange={(e) => setNumbers(e.target.value)}
        style={{ padding: "8px", width: "300px" }}
      />
      <br />
      <button
        onClick={handleSubmit}
        style={{
          marginTop: "10px",
          padding: "10px 20px",
          background: "blue",
          color: "white",
          border: "none",
          borderRadius: "5px",
        }}
      >
        Calculate
      </button>

      {result && (
        <div style={{ marginTop: "20px" }}>
          <h3>Results:</h3>
          <p>Mean: {result.mean.toFixed(2)}</p>
          <p>Standard Deviation: {result.stdDev.toFixed(2)}</p>

          <Line
            data={{
              labels: ["Mean", "Std Dev"],
              datasets: [
                {
                  label: "Values",
                  data: [result.mean, result.stdDev],
                  borderColor: "blue",
                  backgroundColor: "lightblue",
                },
              ],
            }}
          />
        </div>
      )}
    </div>
  );
}

export default App;
