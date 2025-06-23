import plotly.graph_objects as go
import numpy as np

# Define node positions for flowchart layout
positions = {
    1: (0, 0),    # Iniciar Plugin
    2: (0, -1),   # Buscar Todos Flashcards
    3: (0, -2),   # Analisar Duplicatas
    4: (0, -3),   # Mostrar Resultados
    5: (0, -4),   # Decisão do Usuário
    6: (-1, -5.5), # Mesclar Cartões
    7: (0, -5.5),  # Marcar como Verificado
    8: (1, -5.5),  # Ignorar Par
    9: (0, -7)     # Atualizar Lista
}

# Node labels
labels = {
    1: "Iniciar Plugin",
    2: "Buscar Flashcards",
    3: "Analisar Duplicatas",
    4: "Mostrar Resultados",
    5: "Decisão Usuário",
    6: "Mesclar Cartões",
    7: "Marcar Verificado",
    8: "Ignorar Par",
    9: "Atualizar Lista"
}

# Colors from the specified palette
colors = {
    "process": "#1FB8CD",  # Strong cyan
    "decision": "#FFC185",  # Light orange
    "action": "#ECEBD5",    # Light green
    "update": "#5D878F"     # Cyan
}

# Create figure
fig = go.Figure()

# Add nodes
for node_id, (x, y) in positions.items():
    text = labels[node_id]
    
    if node_id == 5:  # Decision node - use path to create diamond
        # Create diamond using path
        size = 0.5
        diamond_path = f'M {x},{y-size} L {x+size},{y} L {x},{y+size} L {x-size},{y} Z'
        fig.add_shape(
            type="path",
            path=diamond_path,
            fillcolor=colors["decision"],
            line_color="#000000",
            line_width=1,
        )
        node_color = colors["decision"]
    elif node_id == 9:  # Update node
        fig.add_shape(
            type="rect",
            x0=x-0.75, y0=y-0.3, x1=x+0.75, y1=y+0.3,
            fillcolor=colors["update"],
            line_color="#000000",
            line_width=1,
        )
        node_color = colors["update"]
    elif node_id in [6, 7, 8]:  # Action nodes
        fig.add_shape(
            type="rect",
            x0=x-0.75, y0=y-0.3, x1=x+0.75, y1=y+0.3,
            fillcolor=colors["action"],
            line_color="#000000",
            line_width=1,
        )
        node_color = colors["action"]
    else:  # Process nodes
        fig.add_shape(
            type="rect",
            x0=x-0.75, y0=y-0.3, x1=x+0.75, y1=y+0.3,
            fillcolor=colors["process"],
            line_color="#000000",
            line_width=1,
        )
        node_color = colors["process"]
    
    # Add text label for each node
    fig.add_annotation(
        x=x, y=y,
        text=text,
        showarrow=False,
        font=dict(size=12, color="#000000"),
    )

# Define edges (connections between nodes)
edges = [
    (1, 2), (2, 3), (3, 4), (4, 5),  # Main flow
    (5, 6), (5, 7), (5, 8),  # Decision branches
    (6, 9), (7, 9), (8, 9),  # All actions to update
    (9, 5)   # Loop back
]

# Add arrows connecting the nodes
for from_id, to_id in edges:
    from_pos = positions[from_id]
    to_pos = positions[to_id]
    
    # Calculate arrow start and end positions
    if from_id == 5:
        # From decision node (diamond)
        if to_id == 6:  # Left branch
            start_x, start_y = from_pos[0]-0.5, from_pos[1]
            end_x, end_y = to_pos[0], to_pos[1]+0.3
        elif to_id == 7:  # Middle branch
            start_x, start_y = from_pos[0], from_pos[1]+0.5
            end_x, end_y = to_pos[0], to_pos[1]+0.3
        elif to_id == 8:  # Right branch
            start_x, start_y = from_pos[0]+0.5, from_pos[1]
            end_x, end_y = to_pos[0], to_pos[1]+0.3
    elif to_id == 5 and from_id == 9:  # Loop back
        # Create a curved path for the loop back arrow
        fig.add_shape(
            type="path",
            path=f"M {from_pos[0]+0.75},{from_pos[1]} C {from_pos[0]+1.5},{from_pos[1]-1.5} {to_pos[0]+1.5},{to_pos[1]-1.5} {to_pos[0]+0.5},{to_pos[1]}",
            line=dict(color="#000000", width=1),
        )
        # Add arrowhead
        fig.add_annotation(
            x=to_pos[0]+0.5, y=to_pos[1],
            ax=to_pos[0]+0.6, ay=to_pos[1],
            xref="x", yref="y", axref="x", ayref="y",
            showarrow=True, arrowhead=2, arrowsize=1, arrowwidth=1, arrowcolor="#000000",
            standoff=0
        )
        continue  # Skip the standard arrow code below
    else:
        # Standard vertical/horizontal arrows
        if from_pos[1] > to_pos[1]:  # Pointing down
            start_x, start_y = from_pos[0], from_pos[1]-0.3
            end_x, end_y = to_pos[0], to_pos[1]+0.3
        elif from_pos[1] < to_pos[1]:  # Pointing up
            start_x, start_y = from_pos[0], from_pos[1]+0.3
            end_x, end_y = to_pos[0], to_pos[1]-0.3
        elif from_pos[0] > to_pos[0]:  # Pointing left
            start_x, start_y = from_pos[0]-0.75, from_pos[1]
            end_x, end_y = to_pos[0]+0.75, to_pos[1]
        else:  # Pointing right
            start_x, start_y = from_pos[0]+0.75, from_pos[1]
            end_x, end_y = to_pos[0]-0.75, to_pos[1]
    
    # Draw the line
    fig.add_shape(
        type="line",
        x0=start_x, y0=start_y,
        x1=end_x, y1=end_y,
        line=dict(color="#000000", width=1),
    )
    
    # Add arrowhead
    fig.add_annotation(
        x=end_x, y=end_y,
        ax=end_x, ay=end_y,
        axref="x", ayref="y",
        text="",
        showarrow=True,
        arrowhead=2,
        arrowsize=1,
        arrowwidth=1,
        arrowcolor="#000000",
        standoff=5
    )

# Set layout properties
fig.update_layout(
    title="Fluxo do Plugin Flashcard Duplicates Finder",
    showlegend=False,
    plot_bgcolor="white",
)

# Remove axes
fig.update_xaxes(visible=False, range=[-2, 2])
fig.update_yaxes(visible=False, range=[-7.5, 0.5])

# Save as PNG
fig.write_image("flashcard_plugin_flowchart.png")

fig.show()