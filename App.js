import React, { useState, useEffect } from "react";
import { database } from "./firebaseConfig";
import { set, ref, onValue, remove, update } from "firebase/database";
import {
  collection,
  addDoc,
  Timestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { uid } from "uid";
function App() {
  const [todos, setTodos] = useState([]);
  const [todo, setTodo] = useState("");
  const [isEdit, setIsEdit] = useState(false);
  const [updateId, setUpdateId] = useState(0);

  useEffect(() => {
    const q = query(collection(database, "tasks"), orderBy("created", "desc"));
    onSnapshot(q, (querySnapshot) => {
      setTodos(
        querySnapshot.docs.map((doc) => ({
          id: doc.id,
          data: doc.data(),
        }))
      );
    });
  }, []);

  const add = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(database, "tasks"), {
        title: todo,
        description: "any",
        completed: false,
        created: Timestamp.now(),
      });
    } catch (err) {
      alert(err);
    }
    setTodo("");
  };

  const deleteTodo = async (id) => {
    const taskDocRef = doc(database, "tasks", id);
    try {
      await deleteDoc(taskDocRef);
    } catch (err) {
      alert(err);
    }
  };

  const updateTodo = async (id) => {
    const taskDocRef = doc(database, "tasks", id);
    try {
      await updateDoc(taskDocRef, {
        title: todo,
      });
    } catch (err) {
      alert(err);
    }
    setTodo("");
  };
  return (
    <div className="App">
      <form onSubmit={add}>
        <input
          type="text"
          placeholder="Add Todo"
          value={todo}
          onChange={(e) => setTodo(e.target.value)}
        />
      </form>
      <br />
      {todos.map((todo, i) => {
        return (
          <div key={i}>
            {todo.id} - {todo.data.title}{" "}
            <button onClick={() => deleteTodo(todo.id)}>X</button>
            {updateId === todo.id && isEdit ? (
              <button onClick={() => updateTodo(todo.id)}>Update</button>
            ) : (
              <button
                onClick={() => {
                  setIsEdit(true);
                  setTodo(todo.data.title);
                  setUpdateId(todo.id);
                }}
              >
                Edit
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;
