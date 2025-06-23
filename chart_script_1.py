import plotly.graph_objects as go
import plotly.express as px

# Data for the algorithm flow
data = {
  "processSteps": [
    {
      "step": 1,
      "name": "Normalização do Texto",
      "description": "Converter para minúsculas, remover acentos e pontuação",
      "example": "O que é Fotossíntese? → o que e fotossintese"
    },
    {
      "step": 2, 
      "name": "Cálculo de Similaridade",
      "description": "Aplicar múltiplos algoritmos de similaridade",
      "subSteps": [
        {"name": "Distância de Levenshtein", "weight": 0.3},
        {"name": "Similaridade de Sequência", "weight": 0.4},
        {"name": "Similaridade Jaccard (palavras)", "weight": 0.3}
      ]
    },
    {
      "step": 3,
      "name": "Classificação de Resultados",
      "description": "Categorizar baseado no nível de similaridade",
      "categories": [
        {"name": "Correspondências Exatas", "threshold": 1.0, "color": "#4caf50"},
        {"name": "Correspondências de Front", "threshold": 0.9, "color": "#2196f3"},
        {"name": "Cartões Similares", "threshold": "0.7-0.89", "color": "#ff9800"}
      ]
    }
  ]
}

# Create figure with shapes and annotations to show flow
fig = go.Figure()

# Add invisible scatter to set up the plot area
fig.add_trace(go.Scatter(x=[0, 10], y=[0, 10], mode='markers', marker=dict(opacity=0), showlegend=False))

# Step 1 - Text Normalization
fig.add_shape(type="rect", x0=1, y0=8, x1=9, y1=9, fillcolor="#1FB8CD", opacity=0.7, line=dict(width=2))
fig.add_annotation(x=5, y=8.5, text="Normalização", showarrow=False, font=dict(size=14, color="white"))

# Arrow 1
fig.add_annotation(x=5, y=7.5, text="↓", showarrow=False, font=dict(size=20))

# Step 2 - Similarity Algorithms
fig.add_shape(type="rect", x0=0.5, y0=5.5, x1=3, y1=6.5, fillcolor="#FFC185", opacity=0.7, line=dict(width=2))
fig.add_annotation(x=1.75, y=6, text="Levenshtein<br>30%", showarrow=False, font=dict(size=10))

fig.add_shape(type="rect", x0=3.8, y0=5.5, x1=6.2, y1=6.5, fillcolor="#ECEBD5", opacity=0.7, line=dict(width=2))
fig.add_annotation(x=5, y=6, text="Sequência<br>40%", showarrow=False, font=dict(size=10))

fig.add_shape(type="rect", x0=7, y0=5.5, x1=9.5, y1=6.5, fillcolor="#5D878F", opacity=0.7, line=dict(width=2))
fig.add_annotation(x=8.25, y=6, text="Jaccard<br>30%", showarrow=False, font=dict(size=10))

# Arrows converging
fig.add_annotation(x=1.75, y=5, text="↘", showarrow=False, font=dict(size=20))
fig.add_annotation(x=5, y=5, text="↓", showarrow=False, font=dict(size=20))
fig.add_annotation(x=8.25, y=5, text="↙", showarrow=False, font=dict(size=20))

# Step 3 - Classification Results
fig.add_shape(type="rect", x0=0.5, y0=2.5, x1=3, y1=3.5, fillcolor="#4caf50", opacity=0.7, line=dict(width=2))
fig.add_annotation(x=1.75, y=3, text="Exatas<br>1.0", showarrow=False, font=dict(size=10, color="white"))

fig.add_shape(type="rect", x0=3.8, y0=2.5, x1=6.2, y1=3.5, fillcolor="#2196f3", opacity=0.7, line=dict(width=2))
fig.add_annotation(x=5, y=3, text="Front Match<br>0.9", showarrow=False, font=dict(size=10, color="white"))

fig.add_shape(type="rect", x0=7, y0=2.5, x1=9.5, y1=3.5, fillcolor="#ff9800", opacity=0.7, line=dict(width=2))
fig.add_annotation(x=8.25, y=3, text="Similares<br>0.7-0.89", showarrow=False, font=dict(size=10, color="white"))

# Add step labels
fig.add_annotation(x=0.2, y=8.5, text="1", showarrow=False, font=dict(size=16, color="black"))
fig.add_annotation(x=0.2, y=6, text="2", showarrow=False, font=dict(size=16, color="black"))
fig.add_annotation(x=0.2, y=3, text="3", showarrow=False, font=dict(size=16, color="black"))

# Update layout
fig.update_layout(
    title="Algoritmo de Similaridade de Cartões",
    xaxis=dict(showgrid=False, showticklabels=False, zeroline=False),
    yaxis=dict(showgrid=False, showticklabels=False, zeroline=False),
    showlegend=False,
    plot_bgcolor="white",
    font_size=12
)

fig.write_image("similarity_algorithm_flow.png")